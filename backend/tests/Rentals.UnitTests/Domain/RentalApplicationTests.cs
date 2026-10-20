using Rentals.Domain.Applications;
using Rentals.Domain.Common;
using static Rentals.UnitTests.TestData;

namespace Rentals.UnitTests.Domain;

public class RentalApplicationTests
{
    [Fact]
    public void Start_creates_a_draft_and_records_who_started_it()
    {
        var application = Draft();

        Assert.Equal(ApplicationStatus.Draft, application.Status);
        var entry = Assert.Single(application.History);
        Assert.Null(entry.FromStatus);
        Assert.Equal(Applicant.Id, entry.ChangedById);
    }

    [Fact]
    public void Start_is_rejected_for_a_unit_with_an_active_lease()
    {
        var unit = Unit();
        Approved(unit);

        var error = Assert.Throws<DomainException>(() => Draft(unit));
        Assert.Equal("unit_not_available", error.Code);
    }

    [Fact]
    public void Saving_a_section_bumps_only_that_sections_version()
    {
        var application = Draft();

        application.SaveApplicantInfo(Applicant, Info(), basedOnVersion: 0, Now);

        Assert.Equal(1, application.ApplicantInfoVersion);
        Assert.Equal(0, application.ResidencesVersion);
        Assert.False(application.AllSectionsSaved);
    }

    [Fact]
    public void Saves_to_different_sections_do_not_conflict()
    {
        var application = Draft();

        // Both edits were based on the same snapshot (all versions 0).
        application.SaveApplicantInfo(Applicant, Info(), basedOnVersion: 0, Now);
        application.SaveResidences(Applicant, [Residence()], basedOnVersion: 0, Now);

        Assert.True(application.AllSectionsSaved);
    }

    [Fact]
    public void A_save_based_on_an_old_version_of_the_section_is_rejected_as_stale()
    {
        var application = Draft();
        application.SaveApplicantInfo(Applicant, Info(), basedOnVersion: 0, Now);

        var error = Assert.Throws<DomainException>(() =>
            application.SaveApplicantInfo(Applicant, Info() with { Phone = "(555) 000-0000" }, basedOnVersion: 0, Now));

        Assert.Equal("stale_section", error.Code);
        Assert.Equal("(555) 123-4567", application.ApplicantInfo.Phone);
    }

    [Fact]
    public void Saving_residences_adds_updates_and_removes_by_id()
    {
        var application = Draft();
        var kept = Residence();
        var removed = Residence();
        application.SaveResidences(Applicant, [kept, removed], 0, Now);

        var added = Residence();
        application.SaveResidences(Applicant, [kept with { LandlordName = "New Name" }, added], 1, Now);

        Assert.Equal(2, application.Residences.Count);
        Assert.Contains(application.Residences, r => r.Id == kept.Id && r.LandlordName == "New Name");
        Assert.Contains(application.Residences, r => r.Id == added.Id);
        Assert.DoesNotContain(application.Residences, r => r.Id == removed.Id);
    }

    [Fact]
    public void Only_the_applicant_can_edit_their_application()
    {
        var application = Draft();

        var error = Assert.Throws<DomainException>(() => application.SaveApplicantInfo(OtherApplicant, Info(), 0, Now));

        Assert.Equal("not_an_applicant", error.Code);
        Assert.False(application.CanBeEditedBy(OtherApplicant.Id));
    }

    [Fact]
    public void A_submitted_application_is_read_only()
    {
        var application = Submitted();

        Assert.False(application.CanBeEditedBy(Applicant.Id));
        var error = Assert.Throws<DomainException>(() => application.SaveApplicantInfo(Applicant, Info(), 1, Now));
        Assert.Equal("application_not_editable", error.Code);
    }

    [Fact]
    public void Submit_requires_both_sections_to_be_saved()
    {
        var application = Draft();
        application.SaveApplicantInfo(Applicant, Info(), 0, Now);

        Assert.False(application.CanBeSubmittedBy(Applicant.Id));
        var error = Assert.Throws<DomainException>(() => application.Submit(Applicant, Today, Now));
        Assert.Equal("sections_incomplete", error.Code);
    }

    [Fact]
    public void Submit_is_rejected_when_the_unit_has_an_active_lease_and_other_applications_are_left_alone()
    {
        var unit = Unit();
        var competing = Completed(unit);
        Approved(unit);

        var error = Assert.Throws<DomainException>(() => competing.Submit(Applicant, Today, Now));

        Assert.Equal("unit_has_active_lease", error.Code);
        Assert.Equal(ApplicationStatus.Draft, competing.Status);
    }

    [Fact]
    public void Replaying_a_submit_is_a_no_op()
    {
        var application = Submitted();
        var historyCount = application.History.Count;

        application.Submit(Applicant, Today, Now);

        Assert.Equal(ApplicationStatus.Submitted, application.Status);
        Assert.Equal(historyCount, application.History.Count);
    }

    [Fact]
    public void A_returned_application_can_be_corrected_and_resubmitted()
    {
        var application = UnderReview();
        application.CompleteReview(Manager, ReviewOutcome.Return, "Add your previous landlord's phone.", null, Today, Now.AddMinutes(-30));

        Assert.True(application.CanBeEditedBy(Applicant.Id));
        application.SaveResidences(Applicant, [Residence()], application.ResidencesVersion, Now.AddMinutes(-20));
        application.Submit(Applicant, Today, Now.AddMinutes(-10));

        Assert.Equal(ApplicationStatus.Submitted, application.Status);
    }

    [Fact]
    public void The_review_must_be_claimed_before_it_can_be_completed()
    {
        var application = Submitted();

        var error = Assert.Throws<DomainException>(() =>
            application.CompleteReview(Manager, ReviewOutcome.Approve, null, Today, Today, Now));

        Assert.Equal("application_not_claimed", error.Code);
    }

    [Fact]
    public void Only_the_manager_who_claimed_the_application_can_complete_or_release_it()
    {
        var application = UnderReview(reviewer: Manager);

        var complete = Assert.Throws<DomainException>(() =>
            application.CompleteReview(OtherManager, ReviewOutcome.Deny, "No", null, Today, Now));
        var release = Assert.Throws<DomainException>(() => application.Release(OtherManager, Now));
        var claim = Assert.Throws<DomainException>(() => application.Claim(OtherManager, Now));

        Assert.All(new[] { complete, release, claim }, e => Assert.Equal("claimed_by_another_reviewer", e.Code));
    }

    [Fact]
    public void Releasing_puts_the_application_back_in_the_queue()
    {
        var application = UnderReview();

        application.Release(Manager, Now);

        Assert.Equal(ApplicationStatus.Submitted, application.Status);
        Assert.Null(application.ReviewerId);
    }

    [Theory]
    [InlineData(ReviewOutcome.Return)]
    [InlineData(ReviewOutcome.Deny)]
    public void Return_and_deny_require_a_comment(ReviewOutcome outcome)
    {
        var application = UnderReview();

        var error = Assert.Throws<DomainException>(() =>
            application.CompleteReview(Manager, outcome, "  ", null, Today, Now));

        Assert.Equal("comment_required", error.Code);
        Assert.Equal("comment", error.Field);
    }

    [Fact]
    public void Approval_issues_a_twelve_month_lease_and_records_the_outcome()
    {
        var unit = Unit();
        var application = UnderReview(unit);
        var start = Today.AddDays(14);

        var lease = application.CompleteReview(Manager, ReviewOutcome.Approve, "Looks good", start, Today, Now);

        Assert.NotNull(lease);
        Assert.Equal(start, lease.StartDate);
        Assert.Equal(start.AddMonths(12).AddDays(-1), lease.EndDate);
        Assert.Equal(ApplicationStatus.Approved, application.Status);
        Assert.Contains(lease, unit.Leases);

        var decision = application.History.MaxBy(h => h.ChangedAt)!;
        Assert.Equal(ReviewOutcome.Approve, decision.Outcome);
        Assert.Equal(Manager.Name, decision.ChangedByName);
        Assert.Equal("Looks good", decision.Comment);
    }

    [Fact]
    public void Approval_is_rejected_when_the_unit_already_has_an_active_lease()
    {
        var unit = Unit();
        var second = UnderReview(unit);
        Approved(unit);

        var error = Assert.Throws<DomainException>(() =>
            second.CompleteReview(Manager, ReviewOutcome.Approve, null, Today, Today, Now));

        Assert.Equal("unit_has_active_lease", error.Code);
        Assert.Single(unit.Leases);
        Assert.Equal(ApplicationStatus.UnderReview, second.Status);
    }

    [Fact]
    public void Approval_is_rejected_when_the_new_lease_would_overlap_an_upcoming_one()
    {
        var unit = Unit();
        var second = UnderReview(unit);
        Approved(unit, leaseStart: Today.AddMonths(2));

        var error = Assert.Throws<DomainException>(() =>
            second.CompleteReview(Manager, ReviewOutcome.Approve, null, Today, Today, Now));

        Assert.Equal("lease_overlaps", error.Code);
    }

    [Fact]
    public void A_lease_cannot_start_in_the_past()
    {
        var application = UnderReview();

        var error = Assert.Throws<DomainException>(() =>
            application.CompleteReview(Manager, ReviewOutcome.Approve, null, Today.AddDays(-1), Today, Now));

        Assert.Equal("lease_start_in_past", error.Code);
    }

    [Fact]
    public void Terminal_applications_cannot_be_withdrawn()
    {
        var application = Approved(Unit());

        var error = Assert.Throws<DomainException>(() => application.Withdraw(Applicant, null, Now));

        Assert.Equal("invalid_status_transition", error.Code);
    }

    [Fact]
    public void Withdrawing_records_the_reason_and_replaying_it_is_a_no_op()
    {
        var application = Submitted();

        application.Withdraw(Applicant, "Found another place", Now);
        application.Withdraw(Applicant, "Found another place", Now);

        Assert.Equal(ApplicationStatus.Withdrawn, application.Status);
        Assert.Single(application.History, h => h.ToStatus == ApplicationStatus.Withdrawn);
        Assert.Equal("Found another place", application.History.MaxBy(h => h.ChangedAt)!.Comment);
    }

    [Fact]
    public void Manager_notes_reject_stale_saves()
    {
        var application = Submitted();
        application.UpdateManagerNotes("Called landlord", basedOnVersion: 0);

        var error = Assert.Throws<DomainException>(() => application.UpdateManagerNotes("Other", basedOnVersion: 0));

        Assert.Equal("stale_notes", error.Code);
        Assert.Equal("Called landlord", application.ManagerNotes);
    }
}
