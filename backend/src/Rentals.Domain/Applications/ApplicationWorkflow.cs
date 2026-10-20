using static Rentals.Domain.Applications.ApplicationStatus;

namespace Rentals.Domain.Applications;

/// <summary>The application status state machine. The single source of truth for allowed transitions.</summary>
public static class ApplicationWorkflow
{
    private static readonly IReadOnlyDictionary<ApplicationStatus, ApplicationStatus[]> Transitions =
        new Dictionary<ApplicationStatus, ApplicationStatus[]>
        {
            [Draft] = [Submitted, Withdrawn],
            [Submitted] = [UnderReview, Withdrawn],
            [UnderReview] = [Submitted, Approved, Returned, Denied, Withdrawn],
            [Returned] = [Submitted, Withdrawn],
            [Approved] = [],
            [Denied] = [],
            [Withdrawn] = [],
        };

    /// <summary>Statuses from which the application can still move on.</summary>
    public static readonly ApplicationStatus[] OpenStatuses = [Draft, Submitted, UnderReview, Returned];

    public static bool CanTransition(ApplicationStatus from, ApplicationStatus to) => Transitions[from].Contains(to);

    public static bool IsTerminal(ApplicationStatus status) => Transitions[status].Length == 0;

    /// <summary>The applicant may change section data only while the application is a draft or was returned.</summary>
    public static bool IsEditable(ApplicationStatus status) => status is Draft or Returned;

    public static ApplicationStatus StatusFor(ReviewOutcome outcome) => outcome switch
    {
        ReviewOutcome.Approve => Approved,
        ReviewOutcome.Return => Returned,
        ReviewOutcome.Deny => Denied,
        _ => throw new ArgumentOutOfRangeException(nameof(outcome), outcome, null),
    };
}
