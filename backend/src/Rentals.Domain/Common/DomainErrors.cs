using Rentals.Domain.Applications;

namespace Rentals.Domain.Common;

/// <summary>Catalogue of business rule violations. Codes are part of the API contract.</summary>
public static class DomainErrors
{
    public static DomainException UnitTypeInactive(string name) =>
        new("unit_type_inactive", $"Unit type '{name}' is inactive and cannot be selected.", "unitTypeId");

    public static DomainException UnitNotAvailable() =>
        new("unit_not_available", "This unit is not available for new applications.");

    public static DomainException UnitHasActiveLease() =>
        new("unit_has_active_lease", "This unit already has an active lease.");

    public static DomainException LeaseOverlaps() =>
        new("lease_overlaps", "The lease term overlaps an existing lease for this unit.", "leaseStartDate");

    public static DomainException LeaseStartInPast() =>
        new("lease_start_in_past", "The lease cannot start in the past.", "leaseStartDate");

    public static DomainException UnitInUse() =>
        new("unit_in_use", "This unit has open applications or a current or upcoming lease and cannot be removed.");

    public static DomainException PropertyInUse() =>
        new("property_in_use", "This property has units with open applications or a current or upcoming lease and cannot be removed.");

    public static DomainException InvalidTransition(ApplicationStatus from, ApplicationStatus to) =>
        new("invalid_status_transition", $"An application that is {from} cannot be moved to {to}.");

    public static DomainException NotEditable(ApplicationStatus status) =>
        new("application_not_editable", $"This application is {status} and can no longer be edited.");

    public static DomainException NotAnApplicant() =>
        new("not_an_applicant", "Only applicants on this application can change it.");

    public static DomainException TooManyApplicants(int max) =>
        new("too_many_applicants", $"An application can have at most {max} applicants.", "email");

    public static DomainException CannotRemovePrimaryApplicant() =>
        new("cannot_remove_primary_applicant", "The applicant who started the application cannot be removed.");

    public static DomainException CannotRemoveApplicant() =>
        new("cannot_remove_applicant", "Only the primary applicant can remove other applicants.");

    public static DomainException ApplicantAccountNotFound() =>
        new("applicant_not_found", "There is no applicant account with this email.", "email");

    public static DomainException SectionsIncomplete() =>
        new("sections_incomplete", "Both sections must be saved before the application can be submitted.");

    public static DomainException StaleSection(ApplicationSection section) =>
        new("stale_section", $"The {section.DisplayName()} section was changed by someone else. Reload to see the latest version.");

    public static DomainException StaleNotes() =>
        new("stale_notes", "The notes were changed by someone else. Reload to see the latest version.");

    public static DomainException CommentRequired(ReviewOutcome outcome) =>
        new("comment_required", $"A comment is required to {outcome.ToString().ToLowerInvariant()} an application.", "comment");

    public static DomainException NotClaimed() =>
        new("application_not_claimed", "Claim the application from the review queue before completing the review.");

    public static DomainException ClaimedByAnotherReviewer(string reviewerName) =>
        new("claimed_by_another_reviewer", $"This application is being reviewed by {reviewerName}.");
}
