using Rentals.Domain.Common;
using Rentals.Domain.Leasing;
using Rentals.Domain.Properties;
using static Rentals.Domain.Applications.ApplicationStatus;

namespace Rentals.Domain.Applications;

/// <summary>
/// Aggregate root for a rental application. Every state change goes through a method here so the
/// workflow rules, edit permissions and audit history cannot be bypassed.
/// </summary>
/// <remarks>
/// <para>
/// An application has a primary applicant (who started it) and optional co-applicants. Everyone on the
/// application can view, edit, submit and withdraw it.
/// </para>
/// <para>
/// Each section carries its own version number. A save must name the version it was based on; a
/// mismatch means someone else saved that section in the meantime and the save is rejected as stale.
/// Saves to different sections never conflict with each other.
/// </para>
/// <para>
/// Sections may be saved as drafts with incomplete or invalid content. Whether a section is complete is
/// decided by the section rules (outside the aggregate); submission requires both sections to be saved.
/// </para>
/// </remarks>
public class RentalApplication
{
    /// <summary>Primary applicant plus co-applicants.</summary>
    public const int MaxApplicants = 4;

    private readonly List<Residence> _residences = [];
    private readonly List<CoApplicant> _coApplicants = [];
    private readonly List<ApplicationStatusChange> _history = [];

    private RentalApplication() { }

    public Guid Id { get; private set; }

    public Guid UnitId { get; private set; }

    public Unit Unit { get; private set; } = null!;

    /// <summary>The primary applicant: the user who started the application.</summary>
    public string ApplicantId { get; private set; } = null!;

    public IReadOnlyCollection<CoApplicant> CoApplicants => _coApplicants;

    public ApplicationStatus Status { get; private set; }

    /// <summary>As last saved; fields may be missing or invalid while the section is a draft.</summary>
    public ApplicantInfo ApplicantInfo { get; private set; } = ApplicantInfo.Blank();

    /// <summary>0 until the section has been saved for the first time.</summary>
    public int ApplicantInfoVersion { get; private set; }

    public int ResidencesVersion { get; private set; }

    public IReadOnlyCollection<Residence> Residences => _residences;

    /// <summary>Internal to property managers; never exposed to applicants.</summary>
    public string? ManagerNotes { get; private set; }

    public int ManagerNotesVersion { get; private set; }

    /// <summary>The property manager who claimed the application from the review queue.</summary>
    public string? ReviewerId { get; private set; }

    public string? ReviewerName { get; private set; }

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    public DateTimeOffset? SubmittedAt { get; private set; }

    public DateTimeOffset? DecidedAt { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public IReadOnlyCollection<ApplicationStatusChange> History => _history;

    public bool IsEditable => ApplicationWorkflow.IsEditable(Status);

    public bool AllSectionsSaved => ApplicantInfoVersion > 0 && ResidencesVersion > 0;

    public IEnumerable<string> ApplicantIds => _coApplicants.Select(c => c.UserId).Prepend(ApplicantId);

    public bool HasApplicant(string userId) => ApplicantId == userId || _coApplicants.Any(c => c.UserId == userId);

    public bool CanBeEditedBy(string userId) => HasApplicant(userId) && IsEditable;

    public bool CanBeSubmittedBy(string userId) =>
        CanBeEditedBy(userId) && AllSectionsSaved && ApplicationWorkflow.CanTransition(Status, Submitted);

    public bool CanBeWithdrawnBy(string userId) =>
        HasApplicant(userId) && ApplicationWorkflow.CanTransition(Status, Withdrawn);

    /// <summary>The primary applicant may remove anyone else; a co-applicant may only remove themselves.</summary>
    public bool CanRemoveApplicant(string actorId, string applicantId) =>
        CanBeEditedBy(actorId) && applicantId != ApplicantId && (actorId == ApplicantId || actorId == applicantId);

    public static RentalApplication Start(Guid id, Unit unit, Actor applicant, DateOnly today, DateTimeOffset now)
    {
        if (!unit.IsAvailableOn(today))
        {
            throw DomainErrors.UnitNotAvailable();
        }

        var application = new RentalApplication
        {
            Id = id,
            UnitId = unit.Id,
            Unit = unit,
            ApplicantId = applicant.Id,
            Status = Draft,
            CreatedAt = now,
            UpdatedAt = now,
        };
        application._history.Add(ApplicationStatusChange.Create(id, null, Draft, applicant, now));
        return application;
    }

    public void AddCoApplicant(Actor actor, string userId, DateTimeOffset now)
    {
        EnsureCanEdit(actor);
        if (HasApplicant(userId))
        {
            return; // Already on the application: adding again (e.g. a replayed request) changes nothing.
        }

        if (_coApplicants.Count + 1 >= MaxApplicants)
        {
            throw DomainErrors.TooManyApplicants(MaxApplicants);
        }

        _coApplicants.Add(CoApplicant.Create(Id, userId, actor.Id, now));
        UpdatedAt = now;
    }

    public void RemoveCoApplicant(Actor actor, string userId, DateTimeOffset now)
    {
        EnsureCanEdit(actor);
        if (userId == ApplicantId)
        {
            throw DomainErrors.CannotRemovePrimaryApplicant();
        }

        if (!CanRemoveApplicant(actor.Id, userId))
        {
            throw DomainErrors.CannotRemoveApplicant();
        }

        if (_coApplicants.RemoveAll(c => c.UserId == userId) > 0)
        {
            UpdatedAt = now;
        }
    }

    /// <summary>Saves the section as given, complete or not (a draft). Only the section version is checked.</summary>
    public void SaveApplicantInfo(Actor actor, ApplicantInfo info, int basedOnVersion, DateTimeOffset now)
    {
        EnsureCanEdit(actor);
        EnsureCurrent(ApplicationSection.ApplicantInfo, ApplicantInfoVersion, basedOnVersion);

        ApplicantInfo = info.Normalized();
        ApplicantInfoVersion++;
        UpdatedAt = now;
    }

    /// <summary>Saves the residence list as given, complete or not (a draft). Only the section version is checked.</summary>
    public void SaveResidences(Actor actor, IReadOnlyList<ResidenceData> residences, int basedOnVersion, DateTimeOffset now)
    {
        EnsureCanEdit(actor);
        EnsureCurrent(ApplicationSection.Residences, ResidencesVersion, basedOnVersion);

        var incomingIds = residences.Select(r => r.Id).ToHashSet();
        _residences.RemoveAll(r => !incomingIds.Contains(r.Id));
        foreach (var data in residences)
        {
            var existing = _residences.Find(r => r.Id == data.Id);
            if (existing is null)
            {
                _residences.Add(Residence.Create(Id, data));
            }
            else
            {
                existing.Update(data);
            }
        }

        ResidencesVersion++;
        UpdatedAt = now;
    }

    /// <summary>
    /// Submits the application. The caller must have checked the sections against the section rules.
    /// Requires <see cref="Unit"/> and its leases to be loaded.
    /// </summary>
    public void Submit(Actor actor, DateOnly today, DateTimeOffset now)
    {
        if (IsReplayOf(Submitted, actor))
        {
            return;
        }

        EnsureApplicant(actor);
        EnsureTransition(Submitted);
        if (!AllSectionsSaved)
        {
            throw DomainErrors.SectionsIncomplete();
        }

        if (Unit.Leases.Any(l => l.Covers(today)))
        {
            throw DomainErrors.UnitHasActiveLease();
        }

        if (Unit.IsDeleted)
        {
            throw DomainErrors.UnitNotAvailable();
        }

        TransitionTo(Submitted, actor, now);
        SubmittedAt = now;
    }

    public void Withdraw(Actor actor, string? reason, DateTimeOffset now)
    {
        if (IsReplayOf(Withdrawn, actor))
        {
            return;
        }

        EnsureApplicant(actor);
        EnsureTransition(Withdrawn);
        ClearReviewer();
        TransitionTo(Withdrawn, actor, now, reason);
    }

    public void Claim(Actor reviewer, DateTimeOffset now)
    {
        if (Status == UnderReview && ReviewerId == reviewer.Id)
        {
            return;
        }

        if (Status == UnderReview)
        {
            throw DomainErrors.ClaimedByAnotherReviewer(ReviewerName ?? "another property manager");
        }

        EnsureTransition(UnderReview);
        ReviewerId = reviewer.Id;
        ReviewerName = reviewer.Name;
        TransitionTo(UnderReview, reviewer, now);
    }

    public void Release(Actor reviewer, DateTimeOffset now)
    {
        if (IsReplayOf(Submitted, reviewer))
        {
            return;
        }

        EnsureClaimedBy(reviewer);
        ClearReviewer();
        TransitionTo(Submitted, reviewer, now);
    }

    /// <summary>
    /// Completes the review. Approval issues a twelve-month lease and is rejected when the unit already
    /// has an active or overlapping lease. Requires <see cref="Unit"/> and its leases to be loaded.
    /// </summary>
    public Lease? CompleteReview(
        Actor reviewer,
        ReviewOutcome outcome,
        string? comment,
        DateOnly? leaseStartDate,
        DateOnly today,
        DateTimeOffset now)
    {
        var target = ApplicationWorkflow.StatusFor(outcome);
        if (IsReplayOf(target, reviewer))
        {
            return null;
        }

        EnsureClaimedBy(reviewer);
        if (outcome != ReviewOutcome.Approve && string.IsNullOrWhiteSpace(comment))
        {
            throw DomainErrors.CommentRequired(outcome);
        }

        Lease? lease = null;
        if (outcome == ReviewOutcome.Approve)
        {
            var startDate = leaseStartDate ?? today;
            if (startDate < today)
            {
                throw DomainErrors.LeaseStartInPast();
            }

            lease = Unit.IssueLease(Id, startDate, today, now);
        }

        ClearReviewer();
        TransitionTo(target, reviewer, now, comment, outcome);
        DecidedAt = now;
        return lease;
    }

    public void UpdateManagerNotes(string? notes, int basedOnVersion)
    {
        if (basedOnVersion != ManagerNotesVersion)
        {
            throw DomainErrors.StaleNotes();
        }

        ManagerNotes = string.IsNullOrWhiteSpace(notes) ? null : notes.Trim();
        ManagerNotesVersion++;
    }

    private void TransitionTo(
        ApplicationStatus target,
        Actor actor,
        DateTimeOffset now,
        string? comment = null,
        ReviewOutcome? outcome = null)
    {
        _history.Add(ApplicationStatusChange.Create(Id, Status, target, actor, now, comment, outcome));
        Status = target;
        UpdatedAt = now;
    }

    /// <summary>
    /// A command replayed after its response was lost (e.g. an offline queue retrying) is treated as a
    /// no-op instead of an error: the application is already where that same user moved it.
    /// </summary>
    private bool IsReplayOf(ApplicationStatus target, Actor actor)
    {
        if (Status != target)
        {
            return false;
        }

        var last = _history.MaxBy(h => h.ChangedAt);
        return last is not null && last.ToStatus == target && last.ChangedById == actor.Id;
    }

    private void EnsureApplicant(Actor actor)
    {
        if (!HasApplicant(actor.Id))
        {
            throw DomainErrors.NotAnApplicant();
        }
    }

    private void EnsureCanEdit(Actor actor)
    {
        EnsureApplicant(actor);
        if (!IsEditable)
        {
            throw DomainErrors.NotEditable(Status);
        }
    }

    private void EnsureTransition(ApplicationStatus target)
    {
        if (!ApplicationWorkflow.CanTransition(Status, target))
        {
            throw DomainErrors.InvalidTransition(Status, target);
        }
    }

    private void EnsureClaimedBy(Actor reviewer)
    {
        if (Status != UnderReview)
        {
            throw Status == Submitted ? DomainErrors.NotClaimed() : DomainErrors.InvalidTransition(Status, UnderReview);
        }

        if (ReviewerId != reviewer.Id)
        {
            throw DomainErrors.ClaimedByAnotherReviewer(ReviewerName ?? "another property manager");
        }
    }

    private static void EnsureCurrent(ApplicationSection section, int currentVersion, int basedOnVersion)
    {
        if (currentVersion != basedOnVersion)
        {
            throw DomainErrors.StaleSection(section);
        }
    }

    private void ClearReviewer()
    {
        ReviewerId = null;
        ReviewerName = null;
    }
}
