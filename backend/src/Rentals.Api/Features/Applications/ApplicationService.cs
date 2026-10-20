using System.Linq.Expressions;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Rentals.Api.Auth;
using Rentals.Api.Common;
using Rentals.Api.Features.Properties;
using Rentals.Domain.Applications;
using Rentals.Domain.Common;
using Rentals.Domain.Users;
using Rentals.Infrastructure.Identity;
using Rentals.Infrastructure.Persistence;

namespace Rentals.Api.Features.Applications;

public sealed class ApplicationService(
    AppDbContext db,
    ICurrentUser user,
    UserManager<AppUser> users,
    ApplicationSectionRules sectionRules,
    TimeProvider clock)
{
    private const int MaxSaveAttempts = 3;

    /// <summary>Filtering, sorting and paging are all translated to SQL.</summary>
    public async Task<PagedResult<ApplicationListItemDto>> ListAsync(ApplicationListQuery query, CancellationToken ct)
    {
        var applications = Visible(db.Applications.AsNoTracking());

        if (query.Status is { } status)
        {
            applications = applications.Where(a => a.Status == status);
        }

        if (query.PropertyId is { } propertyId)
        {
            applications = applications.Where(a => a.Unit.PropertyId == propertyId);
        }

        var total = await applications.CountAsync(ct);
        var appUsers = db.Users;

        var items = await Sort(applications, query.SortBy, query.SortDir)
            .Skip((query.Page - 1) * query.PageSize)
            .Take(query.PageSize)
            .Select(a => new ApplicationListItemDto(
                a.Id,
                a.Status,
                a.UnitId,
                a.Unit.UnitNumber,
                a.Unit.PropertyId,
                a.Unit.Property.Name,
                a.Unit.MonthlyRent,
                appUsers.Where(u => u.Id == a.ApplicantId).Select(u => u.FullName).FirstOrDefault() ?? string.Empty,
                a.CoApplicants.Count(),
                a.ReviewerName,
                a.CreatedAt,
                a.UpdatedAt,
                a.SubmittedAt))
            .ToListAsync(ct);

        return new PagedResult<ApplicationListItemDto>(items, total, query.Page, query.PageSize);
    }

    public async Task<ApplicationViewModel> GetAsync(Guid id, CancellationToken ct)
    {
        var application = await LoadAsync(id, tracking: false, ct);
        return await ToViewModelAsync(application, ct);
    }

    /// <summary>Idempotent: replaying a create with the same id returns the application created the first time.</summary>
    public async Task<(ApplicationViewModel Application, bool Created)> CreateAsync(CreateApplicationRequest request, CancellationToken ct)
    {
        if (await db.Applications.AnyAsync(a => a.Id == request.Id, ct))
        {
            return await Visible(db.Applications).AnyAsync(a => a.Id == request.Id, ct)
                ? (await GetAsync(request.Id, ct), false)
                : throw new DomainException("duplicate_id", "An application with this id already exists.");
        }

        var unit = await db.Units
            .Include(u => u.Leases)
            .FirstOrDefaultAsync(u => u.Id == request.UnitId && u.DeletedAt == null && u.Property.DeletedAt == null, ct)
            ?? throw DomainErrors.UnitNotAvailable();

        db.Applications.Add(RentalApplication.Start(request.Id, unit, user.Actor, clock.Today(), clock.GetUtcNow()));
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueKeyViolation())
        {
            // A concurrent replay of the same create won the race.
            db.ChangeTracker.Clear();
            return (await GetAsync(request.Id, ct), false);
        }

        return (await GetAsync(request.Id, ct), true);
    }

    /// <summary>
    /// The single action behind the application form; the command is the button that was pressed.
    /// <list type="bullet">
    /// <item><c>Continue</c> saves the section only when it passes every rule, then points to the next step.</item>
    /// <item><c>SaveDraft</c> saves the section as it is (within storage limits) and stays on it.</item>
    /// <item><c>Submit</c> submits, unless any section is missing or still has errors.</item>
    /// </list>
    /// </summary>
    public async Task<ApplicationFormResult> SubmitFormAsync(Guid id, ApplicationFormRequest request, CancellationToken ct)
    {
        var actor = user.Actor;
        var now = clock.GetUtcNow();

        if (request.Command != ApplicationFormCommand.Submit)
        {
            var errors = (request.Command, request.Section) switch
            {
                (ApplicationFormCommand.Continue, ApplicationSection.ApplicantInfo) => sectionRules.Validate(request.ApplicantInfo!),
                (ApplicationFormCommand.Continue, _) => sectionRules.Validate(request.Residences!),
                (_, ApplicationSection.ApplicantInfo) => sectionRules.CheckLimits(request.ApplicantInfo!),
                _ => sectionRules.CheckLimits(request.Residences!),
            };
            if (errors.Count > 0)
            {
                throw new RequestValidationException(errors);
            }
        }

        var application = await ExecuteAsync(id, a =>
        {
            switch (request.Command, request.Section)
            {
                case (ApplicationFormCommand.Submit, _):
                    if (a.IsEditable && sectionRules.Review(a) is { IsComplete: false } review)
                    {
                        throw new RequestValidationException(review.BlockingErrors(), "submission_blocked");
                    }

                    a.Submit(actor, clock.Today(), now);
                    break;
                case (_, ApplicationSection.ApplicantInfo):
                    a.SaveApplicantInfo(actor, ToDomain(request.ApplicantInfo!), request.Version!.Value, now);
                    break;
                default:
                    a.SaveResidences(actor, request.Residences!.Select(ToDomain).ToList(), request.Version!.Value, now);
                    break;
            }
        }, ct);

        var next = request switch
        {
            { Command: ApplicationFormCommand.SaveDraft, Section: ApplicationSection.ApplicantInfo } => ApplicationStep.ApplicantInfo,
            { Command: ApplicationFormCommand.SaveDraft } => ApplicationStep.Residences,
            { Command: ApplicationFormCommand.Continue, Section: ApplicationSection.ApplicantInfo } => ApplicationStep.Residences,
            _ => ApplicationStep.Summary,
        };

        return new ApplicationFormResult(await ToViewModelAsync(application, ct), next);
    }

    /// <summary>Adds an existing applicant account as a co-applicant. Adding someone already on it is a no-op.</summary>
    public async Task<ApplicationViewModel> AddApplicantAsync(Guid id, AddApplicantRequest request, CancellationToken ct)
    {
        var account = await users.FindByEmailAsync(request.Email.Trim());
        if (account is null || !await users.IsInRoleAsync(account, Roles.Applicant))
        {
            throw DomainErrors.ApplicantAccountNotFound();
        }

        return await ExecuteAndProjectAsync(id, a => a.AddCoApplicant(user.Actor, account.Id, clock.GetUtcNow()), ct);
    }

    /// <summary>Removes a co-applicant, or lets a co-applicant leave. Removing someone not on it is a no-op.</summary>
    public async Task RemoveApplicantAsync(Guid id, string applicantId, CancellationToken ct)
    {
        await ExecuteAsync(id, a => a.RemoveCoApplicant(user.Actor, applicantId, clock.GetUtcNow()), ct);
    }

    public Task<ApplicationViewModel> WithdrawAsync(Guid id, WithdrawRequest request, CancellationToken ct) =>
        ExecuteAndProjectAsync(id, a => a.Withdraw(user.Actor, request.Reason, clock.GetUtcNow()), ct);

    public Task<ApplicationViewModel> ClaimAsync(Guid id, CancellationToken ct) =>
        ExecuteAndProjectAsync(id, a => a.Claim(user.Actor, clock.GetUtcNow()), ct);

    public Task<ApplicationViewModel> ReleaseAsync(Guid id, CancellationToken ct) =>
        ExecuteAndProjectAsync(id, a => a.Release(user.Actor, clock.GetUtcNow()), ct);

    public Task<ApplicationViewModel> ReviewAsync(Guid id, ReviewRequest request, CancellationToken ct) =>
        ExecuteAndProjectAsync(id, a => a.CompleteReview(
            user.Actor, request.Outcome, request.Comment, request.LeaseStartDate, clock.Today(), clock.GetUtcNow()), ct);

    public Task<ApplicationViewModel> UpdateNotesAsync(Guid id, UpdateNotesRequest request, CancellationToken ct) =>
        ExecuteAndProjectAsync(id, a => a.UpdateManagerNotes(request.Text, request.Version), ct);

    private async Task<ApplicationViewModel> ExecuteAndProjectAsync(Guid id, Action<RentalApplication> command, CancellationToken ct) =>
        await ToViewModelAsync(await ExecuteAsync(id, command, ct), ct);

    /// <summary>
    /// Loads the aggregate, applies the command and saves. The row version makes SQL Server reject a save
    /// that raced with another one; in that case the command is re-applied to freshly loaded state, so the
    /// domain rules (section versions, allowed transitions, lease checks) decide against the latest data.
    /// That is what lets two applicants save different sections at the same time without interfering.
    /// </summary>
    private async Task<RentalApplication> ExecuteAsync(Guid id, Action<RentalApplication> command, CancellationToken ct)
    {
        for (var attempt = 1; ; attempt++)
        {
            var application = await LoadAsync(id, tracking: true, ct);
            command(application);
            try
            {
                await db.SaveChangesAsync(ct);
                return application;
            }
            catch (DbUpdateConcurrencyException) when (attempt < MaxSaveAttempts)
            {
                db.ChangeTracker.Clear();
            }
        }
    }

    private async Task<RentalApplication> LoadAsync(Guid id, bool tracking, CancellationToken ct)
    {
        var query = db.Applications
            .Include(a => a.Unit).ThenInclude(u => u.Property)
            .Include(a => a.Unit).ThenInclude(u => u.UnitType)
            .Include(a => a.Unit).ThenInclude(u => u.Leases)
            .Include(a => a.Residences)
            .Include(a => a.CoApplicants)
            .Include(a => a.History)
            .AsSplitQuery();

        if (!tracking)
        {
            query = query.AsNoTracking();
        }

        // Applicants only ever see applications they are on; anything else is reported as not found.
        return await Visible(query).FirstOrDefaultAsync(a => a.Id == id, ct)
            ?? throw new NotFoundException("Application not found.");
    }

    private IQueryable<RentalApplication> Visible(IQueryable<RentalApplication> query)
    {
        if (user.IsManager)
        {
            return query;
        }

        var userId = user.Id;
        return query.Where(a => a.ApplicantId == userId || a.CoApplicants.Any(c => c.UserId == userId));
    }

    private IOrderedQueryable<RentalApplication> Sort(IQueryable<RentalApplication> query, ApplicationSortField field, SortDirection direction)
    {
        var appUsers = db.Users;
        var sorted = field switch
        {
            ApplicationSortField.CreatedAt => Order(query, a => a.CreatedAt, direction),
            ApplicationSortField.SubmittedAt => Order(query, a => a.SubmittedAt, direction),
            ApplicationSortField.Status => Order(query, a => a.Status, direction),
            ApplicationSortField.Property => Order(query, a => a.Unit.Property.Name, direction),
            ApplicationSortField.Applicant => Order(query, a => appUsers.Where(u => u.Id == a.ApplicantId).Select(u => u.FullName).FirstOrDefault(), direction),
            ApplicationSortField.Rent => Order(query, a => a.Unit.MonthlyRent, direction),
            _ => Order(query, a => a.UpdatedAt, direction),
        };

        // A unique tiebreaker keeps pages stable.
        return sorted.ThenBy(a => a.Id);
    }

    private static IOrderedQueryable<T> Order<T, TKey>(IQueryable<T> query, Expression<Func<T, TKey>> key, SortDirection direction) =>
        direction == SortDirection.Asc ? query.OrderBy(key) : query.OrderByDescending(key);

    private async Task<ApplicationViewModel> ToViewModelAsync(RentalApplication a, CancellationToken ct)
    {
        var applicantIds = a.ApplicantIds.ToList();
        var people = await db.Users.AsNoTracking()
            .Where(u => applicantIds.Contains(u.Id))
            .Select(u => new PersonDto(u.Id, u.FullName, u.Email))
            .ToDictionaryAsync(p => p.Id, ct);

        var userId = user.Id;
        var isManager = user.IsManager;
        var isActiveReviewer = isManager && a.Status == ApplicationStatus.UnderReview && a.ReviewerId == userId;
        var lease = a.Unit.Leases.FirstOrDefault(l => l.ApplicationId == a.Id);
        var decision = a.History.Where(h => h.Outcome is not null).MaxBy(h => h.ChangedAt);
        var review = sectionRules.Review(a);
        var info = a.ApplicantInfo;

        return new ApplicationViewModel(
            a.Id,
            a.Status,
            new ApplicationUnitDto(
                a.Unit.Id,
                a.Unit.UnitNumber,
                a.Unit.Bedrooms,
                a.Unit.MonthlyRent,
                a.Unit.UnitType.Name,
                a.Unit.PropertyId,
                a.Unit.Property.Name,
                a.Unit.Property.Address,
                a.Unit.Property.City),
            people[a.ApplicantId],
            applicantIds
                .Where(people.ContainsKey)
                .Select(id => new ApplicantDto(
                    id,
                    people[id].FullName,
                    people[id].Email,
                    IsPrimary: id == a.ApplicantId,
                    CanRemove: a.CanRemoveApplicant(userId, id)))
                .ToList(),
            IsEditable: a.CanBeEditedBy(userId),
            new ApplicationPermissions(
                CanEdit: a.CanBeEditedBy(userId),
                CanSubmit: a.CanBeSubmittedBy(userId) && review.IsComplete,
                CanWithdraw: a.CanBeWithdrawnBy(userId),
                CanClaim: isManager && a.Status == ApplicationStatus.Submitted,
                CanRelease: isActiveReviewer,
                CanReview: isActiveReviewer,
                CanEditNotes: isManager,
                CanManageApplicants: a.CanBeEditedBy(userId)),
            new ApplicationSectionsDto(
                new ApplicantInfoSectionDto(
                    a.ApplicantInfoVersion > 0 ? new ApplicantInfoDto(info.FullName, info.Phone, info.Email, info.CurrentAddress) : null,
                    IsSaved: a.ApplicantInfoVersion > 0,
                    a.ApplicantInfoVersion,
                    review.ApplicantInfo.Status,
                    review.ApplicantInfo.Errors),
                new ResidencesSectionDto(
                    ApplicationSectionRules.OrderedResidences(a)
                        .Select(r => new ResidenceDto(r.Id, r.Address, r.LandlordName, r.LandlordPhone, r.MoveInDate, r.MoveOutDate))
                        .ToList(),
                    IsSaved: a.ResidencesVersion > 0,
                    a.ResidencesVersion,
                    review.Residences.Status,
                    review.Residences.Errors)),
            lease is null ? null : new LeaseDto(lease.Id, lease.ApplicationId, lease.StartDate, lease.EndDate),
            a.ReviewerId is null ? null : new PersonDto(a.ReviewerId, a.ReviewerName ?? string.Empty, null),
            a.CreatedAt,
            a.UpdatedAt,
            a.SubmittedAt,
            a.DecidedAt)
        {
            // The applicant sees the latest decision (so they know what to correct); managers see everything.
            LatestDecision = decision is null ? null : new DecisionDto(decision.Outcome!.Value, decision.Comment, decision.ChangedAt),
            History = isManager
                ? a.History
                    .OrderBy(h => h.ChangedAt)
                    .Select(h => new StatusChangeDto(h.Id, h.FromStatus, h.ToStatus, h.Outcome, h.Comment, h.ChangedByName, h.ChangedAt))
                    .ToList()
                : null,
            ManagerNotes = isManager ? new ManagerNotesDto(a.ManagerNotes, a.ManagerNotesVersion) : null,
        };
    }

    private static ApplicantInfo ToDomain(ApplicantInfoInput input) =>
        new(input.FullName, input.Phone, input.Email, input.CurrentAddress);

    private static ResidenceData ToDomain(ResidenceInput input) =>
        new(input.Id, input.Address, input.LandlordName, input.LandlordPhone, input.MoveInDate, input.MoveOutDate);
}
