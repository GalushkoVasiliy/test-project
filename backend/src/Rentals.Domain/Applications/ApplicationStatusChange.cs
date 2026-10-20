using Rentals.Domain.Common;

namespace Rentals.Domain.Applications;

/// <summary>Audit entry: who moved the application between statuses, when, and why.</summary>
public class ApplicationStatusChange
{
    private ApplicationStatusChange() { }

    public Guid Id { get; private set; }

    public Guid ApplicationId { get; private set; }

    /// <summary>Null for the entry that records the application being started.</summary>
    public ApplicationStatus? FromStatus { get; private set; }

    public ApplicationStatus ToStatus { get; private set; }

    public ReviewOutcome? Outcome { get; private set; }

    public string? Comment { get; private set; }

    public string ChangedById { get; private set; } = null!;

    public string ChangedByName { get; private set; } = null!;

    public DateTimeOffset ChangedAt { get; private set; }

    internal static ApplicationStatusChange Create(
        Guid applicationId,
        ApplicationStatus? from,
        ApplicationStatus to,
        Actor actor,
        DateTimeOffset at,
        string? comment = null,
        ReviewOutcome? outcome = null) => new()
        {
            Id = Guid.NewGuid(),
            ApplicationId = applicationId,
            FromStatus = from,
            ToStatus = to,
            Outcome = outcome,
            Comment = string.IsNullOrWhiteSpace(comment) ? null : comment.Trim(),
            ChangedById = actor.Id,
            ChangedByName = actor.Name,
            ChangedAt = at,
        };
}
