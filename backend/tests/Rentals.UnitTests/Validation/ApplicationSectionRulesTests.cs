using System.Text.Json;
using FluentValidation;
using Rentals.Api.Features.Applications;
using Rentals.Domain.Applications;
using static Rentals.UnitTests.TestData;

namespace Rentals.UnitTests.Validation;

public class ApplicationSectionRulesTests
{
    private readonly ApplicationSectionRules _rules = new(new FixedClock(Now));

    static ApplicationSectionRulesTests() =>
        ValidatorOptions.Global.PropertyNameResolver = (_, member, _) =>
            member is null ? null : JsonNamingPolicy.CamelCase.ConvertName(member.Name);

    [Fact]
    public void Applicant_info_errors_are_reported_against_each_field()
    {
        var errors = _rules.Validate(new ApplicantInfoInput("", "not a phone", "nope", ""));

        Assert.Equal(
            ["applicantInfo.currentAddress", "applicantInfo.email", "applicantInfo.fullName", "applicantInfo.phone"],
            errors.Keys.Order());
    }

    [Theory]
    [InlineData("(555) 123-4567", true)]
    [InlineData("+1 555 123 4567", true)]
    [InlineData("555.123.4567", true)]
    [InlineData("12345", false)]
    [InlineData("call me", false)]
    [InlineData("+1 (555) 123-4567 ext", false)]
    public void Phone_numbers_accept_common_formats(string phone, bool valid) =>
        Assert.Equal(valid, _rules.Validate(new ApplicantInfoInput("Alex Carter", phone, "alex@example.com", "1 Main St")).Count == 0);

    [Fact]
    public void Residence_history_requires_at_least_one_residence()
    {
        var errors = _rules.Validate([]);

        Assert.Equal("Add at least one prior residence.", Assert.Single(errors["residences"]));
    }

    [Fact]
    public void Residence_dates_must_be_present_in_order_and_not_in_the_future()
    {
        var errors = _rules.Validate(
        [
            new ResidenceInput(Guid.NewGuid(), "1 Main St", "Pat", "(555) 765-4321", Today.AddYears(-1), Today.AddYears(-2)),
            new ResidenceInput(Guid.NewGuid(), "2 Main St", "Pat", "(555) 765-4321", Today.AddDays(-5), Today.AddDays(5)),
            new ResidenceInput(Guid.NewGuid(), "3 Main St", "Pat", "(555) 765-4321", null, null),
        ]);

        Assert.Equal("Move-out date must be after the move-in date.", Assert.Single(errors["residences[0].moveOutDate"]));
        Assert.Equal("Move-out date cannot be in the future.", Assert.Single(errors["residences[1].moveOutDate"]));
        Assert.Equal("Move-in date is required.", Assert.Single(errors["residences[2].moveInDate"]));
        Assert.Equal("Move-out date is required.", Assert.Single(errors["residences[2].moveOutDate"]));
    }

    [Fact]
    public void A_draft_only_has_to_respect_storage_limits()
    {
        var incomplete = new ApplicantInfoInput("Alex", null, "not-an-email", null);
        var tooLong = new ApplicantInfoInput(new string('a', 101), null, null, null);

        Assert.Empty(_rules.CheckLimits(incomplete));
        Assert.NotEmpty(_rules.Validate(incomplete));
        Assert.Equal(["applicantInfo.fullName"], _rules.CheckLimits(tooLong).Keys);
    }

    [Fact]
    public void Residence_drafts_still_need_unique_ids_and_a_bounded_list()
    {
        var id = Guid.NewGuid();
        var duplicate = new ResidenceInput(id, null, null, null, null, null);
        var tooMany = Enumerable.Range(0, 11).Select(_ => new ResidenceInput(Guid.NewGuid(), null, null, null, null, null)).ToList();

        Assert.Empty(_rules.CheckLimits([duplicate]));
        Assert.Contains("residences", _rules.CheckLimits([duplicate, duplicate]).Keys);
        Assert.Contains("residences", _rules.CheckLimits(tooMany).Keys);
    }

    [Fact]
    public void Review_reports_each_section_as_empty_incomplete_or_complete()
    {
        var application = Draft();
        Assert.Equal(SectionStatus.Empty, _rules.Review(application).ApplicantInfo.Status);

        application.SaveApplicantInfo(Applicant, new ApplicantInfo("Alex", "12", null, null), 0, Now);
        var review = _rules.Review(application);
        Assert.Equal(SectionStatus.Incomplete, review.ApplicantInfo.Status);
        Assert.Contains("applicantInfo.phone", review.ApplicantInfo.Errors.Keys);

        application.SaveApplicantInfo(Applicant, Info(), 1, Now);
        Assert.Equal(SectionStatus.Complete, _rules.Review(application).ApplicantInfo.Status);
    }

    [Fact]
    public void Everything_that_blocks_submission_is_listed()
    {
        var application = Draft();
        application.SaveApplicantInfo(Applicant, new ApplicantInfo("Alex", null, null, null), 0, Now);

        var review = _rules.Review(application);
        var blocking = review.BlockingErrors();

        Assert.False(review.IsComplete);
        Assert.Contains("applicantInfo.phone", blocking.Keys);
        Assert.Equal("Residence History has not been filled in yet.", Assert.Single(blocking["residences"]));
    }

    [Fact]
    public void A_complete_application_has_nothing_blocking()
    {
        var review = _rules.Review(Completed());

        Assert.True(review.IsComplete);
        Assert.Empty(review.BlockingErrors());
    }

    [Fact]
    public void Residence_errors_use_the_display_order()
    {
        var application = Draft();
        var older = new ResidenceData(Guid.NewGuid(), "Old St", "Pat", "(555) 765-4321", Today.AddYears(-5), Today.AddYears(-3));
        var newer = new ResidenceData(Guid.NewGuid(), "New St", null, "(555) 765-4321", Today.AddYears(-3), Today.AddMonths(-1));
        application.SaveResidences(Applicant, [older, newer], 0, Now);

        var ordered = ApplicationSectionRules.OrderedResidences(application);
        var errors = _rules.Review(application).Residences.Errors;

        Assert.Equal(newer.Id, ordered[0].Id);
        Assert.Contains("residences[0].landlordName", errors.Keys);
    }

    [Theory]
    [InlineData(ReviewOutcome.Return, null, false)]
    [InlineData(ReviewOutcome.Deny, "", false)]
    [InlineData(ReviewOutcome.Deny, "Income not verified", true)]
    [InlineData(ReviewOutcome.Approve, null, true)]
    public void Review_comment_is_required_for_return_and_deny(ReviewOutcome outcome, string? comment, bool valid) =>
        Assert.Equal(valid, new ReviewRequestValidator().Validate(new ReviewRequest(outcome, comment, null)).IsValid);

    [Fact]
    public void The_form_envelope_requires_the_posted_section()
    {
        var validator = new ApplicationFormRequestValidator();

        Assert.False(validator.Validate(new ApplicationFormRequest(ApplicationFormCommand.SaveDraft, ApplicationSection.ApplicantInfo, 0, null, null)).IsValid);
        Assert.True(validator.Validate(new ApplicationFormRequest(ApplicationFormCommand.SaveDraft, ApplicationSection.Residences, 0, null, [])).IsValid);
        Assert.True(validator.Validate(new ApplicationFormRequest(ApplicationFormCommand.Submit, null, null, null, null)).IsValid);
    }
}
