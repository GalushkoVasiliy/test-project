namespace Rentals.Domain.Applications;

public enum ApplicationStatus
{
    Draft,
    Submitted,
    UnderReview,
    Returned,
    Approved,
    Denied,
    Withdrawn,
}

public enum ReviewOutcome
{
    Approve,
    Return,
    Deny,
}

public enum ApplicationSection
{
    ApplicantInfo,
    Residences,
}

public static class ApplicationSectionExtensions
{
    public static string DisplayName(this ApplicationSection section) => section switch
    {
        ApplicationSection.ApplicantInfo => "Applicant Information",
        ApplicationSection.Residences => "Residence History",
        _ => section.ToString(),
    };
}
