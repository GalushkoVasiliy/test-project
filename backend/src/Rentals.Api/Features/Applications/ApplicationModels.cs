using System.Text.Json.Serialization;
using Rentals.Api.Common;
using Rentals.Api.Features.Properties;
using Rentals.Domain.Applications;

namespace Rentals.Api.Features.Applications;

public enum ApplicationSortField
{
    UpdatedAt,
    CreatedAt,
    SubmittedAt,
    Status,
    Property,
    Applicant,
    Rent,
}

public sealed record ApplicationListQuery
{
    public ApplicationStatus? Status { get; init; }

    public Guid? PropertyId { get; init; }

    public int Page { get; init; } = 1;

    public int PageSize { get; init; } = 20;

    public ApplicationSortField SortBy { get; init; } = ApplicationSortField.UpdatedAt;

    public SortDirection SortDir { get; init; } = SortDirection.Desc;
}

public sealed record ApplicationListItemDto(
    Guid Id,
    ApplicationStatus Status,
    Guid UnitId,
    string UnitNumber,
    Guid PropertyId,
    string PropertyName,
    decimal MonthlyRent,
    string ApplicantName,
    int CoApplicantCount,
    string? ReviewerName,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? SubmittedAt);

/// <summary>
/// The single view model that drives the application page. The server decides whether each section is
/// editable and which actions the caller may take; the client only renders what it is given.
/// </summary>
public sealed record ApplicationViewModel(
    Guid Id,
    ApplicationStatus Status,
    ApplicationUnitDto Unit,
    PersonDto Applicant,
    IReadOnlyList<ApplicantDto> Applicants,
    bool IsEditable,
    ApplicationPermissions Permissions,
    ApplicationSectionsDto Sections,
    LeaseDto? Lease,
    PersonDto? Reviewer,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt,
    DateTimeOffset? SubmittedAt,
    DateTimeOffset? DecidedAt)
{
    /// <summary>The most recent review outcome, so an applicant knows why an application was returned or denied.</summary>
    public DecisionDto? LatestDecision { get; init; }

    /// <summary>Status changes and review outcomes. Property managers only.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public IReadOnlyList<StatusChangeDto>? History { get; init; }

    /// <summary>Internal notes. Property managers only — never returned to an applicant.</summary>
    [JsonIgnore(Condition = JsonIgnoreCondition.WhenWritingNull)]
    public ManagerNotesDto? ManagerNotes { get; init; }
}

public sealed record ApplicationUnitDto(
    Guid Id,
    string UnitNumber,
    int Bedrooms,
    decimal MonthlyRent,
    string UnitTypeName,
    Guid PropertyId,
    string PropertyName,
    string PropertyAddress,
    string City);

public sealed record PersonDto(string Id, string FullName, string? Email);

/// <summary>Someone on the application. <c>CanRemove</c> is evaluated for the caller.</summary>
public sealed record ApplicantDto(string Id, string FullName, string? Email, bool IsPrimary, bool CanRemove);

public sealed record ApplicationPermissions(
    bool CanEdit,
    bool CanSubmit,
    bool CanWithdraw,
    bool CanClaim,
    bool CanRelease,
    bool CanReview,
    bool CanEditNotes,
    bool CanManageApplicants);

public sealed record ApplicationSectionsDto(ApplicantInfoSectionDto ApplicantInfo, ResidencesSectionDto Residences);

/// <summary>
/// A section as stored, with its status and — for a draft saved with errors — the errors computed by the
/// section rules, keyed by field path.
/// </summary>
public sealed record ApplicantInfoSectionDto(
    ApplicantInfoDto? Data,
    bool IsSaved,
    int Version,
    SectionStatus Status,
    IReadOnlyDictionary<string, string[]> Errors);

/// <summary>Residence errors refer to items by their index in <c>Data</c>.</summary>
public sealed record ResidencesSectionDto(
    IReadOnlyList<ResidenceDto> Data,
    bool IsSaved,
    int Version,
    SectionStatus Status,
    IReadOnlyDictionary<string, string[]> Errors);

public sealed record ApplicantInfoDto(string? FullName, string? Phone, string? Email, string? CurrentAddress);

public sealed record ResidenceDto(
    Guid Id,
    string? Address,
    string? LandlordName,
    string? LandlordPhone,
    DateOnly? MoveInDate,
    DateOnly? MoveOutDate);

public sealed record StatusChangeDto(
    Guid Id,
    ApplicationStatus? FromStatus,
    ApplicationStatus ToStatus,
    ReviewOutcome? Outcome,
    string? Comment,
    string ChangedByName,
    DateTimeOffset ChangedAt);

public sealed record ManagerNotesDto(string? Text, int Version);

public sealed record DecisionDto(ReviewOutcome Outcome, string? Comment, DateTimeOffset DecidedAt);

/// <summary>Client-generated id: replaying the request returns the application created the first time.</summary>
public sealed record CreateApplicationRequest(Guid Id, Guid UnitId);

public enum ApplicationFormCommand
{
    /// <summary>Validate the current section and save it only when valid, then move to the next one.</summary>
    Continue,

    /// <summary>Save the current section as it is, even with errors; the errors are returned with it.</summary>
    SaveDraft,

    /// <summary>Submit the application (Summary only, both sections saved).</summary>
    Submit,
}

public enum ApplicationStep
{
    ApplicantInfo,
    Residences,
    Summary,
}

/// <summary>
/// The application form posts to one action; <see cref="Command"/> says which button was pressed.
/// Save draft keeps whatever was entered (errors included); Back is not posted: it returns to the
/// previous section without saving anything.
/// </summary>
public sealed record ApplicationFormRequest(
    ApplicationFormCommand Command,
    ApplicationSection? Section,
    int? Version,
    ApplicantInfoInput? ApplicantInfo,
    IReadOnlyList<ResidenceInput>? Residences);

public sealed record ApplicantInfoInput(string? FullName, string? Phone, string? Email, string? CurrentAddress);

public sealed record ResidenceInput(
    Guid Id,
    string? Address,
    string? LandlordName,
    string? LandlordPhone,
    DateOnly? MoveInDate,
    DateOnly? MoveOutDate);

public sealed record ApplicationFormResult(ApplicationViewModel Application, ApplicationStep NextStep);

public sealed record WithdrawRequest(string? Reason);

/// <summary>Adds an existing applicant account, by email, as a co-applicant.</summary>
public sealed record AddApplicantRequest(string Email);

public sealed record ReviewRequest(ReviewOutcome Outcome, string? Comment, DateOnly? LeaseStartDate);

public sealed record UpdateNotesRequest(string? Text, int Version);
