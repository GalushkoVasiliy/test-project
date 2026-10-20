using Rentals.Domain.Applications;
using static Rentals.Domain.Applications.ApplicationStatus;

namespace Rentals.UnitTests.Domain;

public class ApplicationWorkflowTests
{
    [Theory]
    [InlineData(Draft, Submitted)]
    [InlineData(Draft, Withdrawn)]
    [InlineData(Submitted, UnderReview)]
    [InlineData(Submitted, Withdrawn)]
    [InlineData(UnderReview, Submitted)]
    [InlineData(UnderReview, Approved)]
    [InlineData(UnderReview, Returned)]
    [InlineData(UnderReview, Denied)]
    [InlineData(Returned, Submitted)]
    [InlineData(Returned, Withdrawn)]
    public void Allows_valid_transitions(ApplicationStatus from, ApplicationStatus to) =>
        Assert.True(ApplicationWorkflow.CanTransition(from, to));

    [Theory]
    [InlineData(Draft, Approved)]
    [InlineData(Draft, UnderReview)]
    [InlineData(Submitted, Approved)]
    [InlineData(Returned, Approved)]
    [InlineData(Approved, Withdrawn)]
    [InlineData(Denied, Submitted)]
    [InlineData(Withdrawn, Submitted)]
    public void Rejects_invalid_transitions(ApplicationStatus from, ApplicationStatus to) =>
        Assert.False(ApplicationWorkflow.CanTransition(from, to));

    [Theory]
    [InlineData(Approved)]
    [InlineData(Denied)]
    [InlineData(Withdrawn)]
    public void Approved_denied_and_withdrawn_are_terminal(ApplicationStatus status)
    {
        Assert.True(ApplicationWorkflow.IsTerminal(status));
        Assert.DoesNotContain(status, ApplicationWorkflow.OpenStatuses);
    }

    [Theory]
    [InlineData(Draft, true)]
    [InlineData(Returned, true)]
    [InlineData(Submitted, false)]
    [InlineData(UnderReview, false)]
    [InlineData(Approved, false)]
    [InlineData(Denied, false)]
    [InlineData(Withdrawn, false)]
    public void Only_draft_and_returned_applications_are_editable(ApplicationStatus status, bool editable) =>
        Assert.Equal(editable, ApplicationWorkflow.IsEditable(status));
}
