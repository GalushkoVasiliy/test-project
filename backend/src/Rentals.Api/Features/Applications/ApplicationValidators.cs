using FluentValidation;
using Rentals.Api.Common;
using Rentals.Domain.Applications;

namespace Rentals.Api.Features.Applications;

// Section rules come in two kinds, each defined once (see ApplicationSectionRules for how they are used):
//  * Limits protect storage (column sizes, ids) and hold even for a section saved as a draft.
//  * Rules decide whether a section is complete; they block Continue and Submit, but not Save draft.
// Errors are keyed by the JSON path of the field (e.g. "applicantInfo.email", "residences[1].moveOutDate").

public sealed class ApplicantInfoLimits : AbstractValidator<ApplicantInfoInput>
{
    public ApplicantInfoLimits()
    {
        RuleFor(i => i.FullName).MaximumLength(100).WithMessage("Full name must be at most 100 characters.");
        RuleFor(i => i.Phone).MaximumLength(30).WithMessage("Phone must be at most 30 characters.");
        RuleFor(i => i.Email).MaximumLength(256).WithMessage("Email must be at most 256 characters.");
        RuleFor(i => i.CurrentAddress).MaximumLength(200).WithMessage("Current address must be at most 200 characters.");
    }
}

public sealed class ApplicantInfoRules : AbstractValidator<ApplicantInfoInput>
{
    public ApplicantInfoRules()
    {
        RuleFor(i => i.FullName).NotEmpty().WithMessage("Full name is required.");
        RuleFor(i => i.Phone)
            .NotEmpty().WithMessage("Phone is required.")
            .Matches(ValidationPatterns.Phone).WithMessage("Enter a valid phone number.");
        RuleFor(i => i.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.");
        RuleFor(i => i.CurrentAddress).NotEmpty().WithMessage("Current address is required.");
    }
}

/// <summary>The Residence History section as a whole, so list-level and item-level errors share one path.</summary>
public sealed record ResidenceHistoryInput(IReadOnlyList<ResidenceInput> Residences);

public sealed class ResidenceHistoryLimits : AbstractValidator<ResidenceHistoryInput>
{
    public const int MaxResidences = 10;

    public ResidenceHistoryLimits()
    {
        RuleFor(h => h.Residences)
            .Must(list => list.Count <= MaxResidences).WithMessage($"You can list up to {MaxResidences} residences.")
            .Must(list => list.Select(r => r.Id).Distinct().Count() == list.Count).WithMessage("Each residence must have a unique id.");
        RuleForEach(h => h.Residences).ChildRules(residence =>
        {
            residence.RuleFor(r => r.Id).NotEmpty();
            residence.RuleFor(r => r.Address).MaximumLength(200).WithMessage("Address must be at most 200 characters.");
            residence.RuleFor(r => r.LandlordName).MaximumLength(100).WithMessage("Landlord name must be at most 100 characters.");
            residence.RuleFor(r => r.LandlordPhone).MaximumLength(30).WithMessage("Landlord phone must be at most 30 characters.");
        });
    }
}

public sealed class ResidenceHistoryRules : AbstractValidator<ResidenceHistoryInput>
{
    public ResidenceHistoryRules(TimeProvider clock)
    {
        RuleFor(h => h.Residences).NotEmpty().WithMessage("Add at least one prior residence.");
        RuleForEach(h => h.Residences).ChildRules(residence =>
        {
            residence.RuleFor(r => r.Address).NotEmpty().WithMessage("Address is required.");
            residence.RuleFor(r => r.LandlordName).NotEmpty().WithMessage("Landlord name is required.");
            residence.RuleFor(r => r.LandlordPhone)
                .NotEmpty().WithMessage("Landlord phone is required.")
                .Matches(ValidationPatterns.Phone).WithMessage("Enter a valid phone number.");
            residence.RuleFor(r => r.MoveInDate)
                .NotNull().WithMessage("Move-in date is required.")
                .Must(d => d is null || d <= clock.Today()).WithMessage("Move-in date cannot be in the future.");
            residence.RuleFor(r => r.MoveOutDate)
                .NotNull().WithMessage("Move-out date is required.")
                .Must(d => d is null || d <= clock.Today()).WithMessage("Move-out date cannot be in the future.")
                .GreaterThan(r => r.MoveInDate).When(r => r.MoveInDate is not null, ApplyConditionTo.CurrentValidator)
                .WithMessage("Move-out date must be after the move-in date.");
        });
    }
}

/// <summary>
/// Checks the envelope of the form post. The section content itself is checked by
/// <see cref="ApplicationSectionRules"/>, because what is enforced depends on the command.
/// </summary>
public sealed class ApplicationFormRequestValidator : AbstractValidator<ApplicationFormRequest>
{
    public ApplicationFormRequestValidator()
    {
        RuleFor(r => r.Command).IsInEnum();

        When(r => r.Command is ApplicationFormCommand.Continue or ApplicationFormCommand.SaveDraft, () =>
        {
            RuleFor(r => r.Section).NotNull().IsInEnum().WithMessage("Section is required.");
            RuleFor(r => r.Version).NotNull().GreaterThanOrEqualTo(0);
            RuleFor(r => r.ApplicantInfo)
                .NotNull().When(r => r.Section == ApplicationSection.ApplicantInfo)
                .WithMessage("Applicant information is required.");
            RuleFor(r => r.Residences)
                .NotNull().When(r => r.Section == ApplicationSection.Residences)
                .WithMessage("Residences are required.");
        });
    }
}

public sealed class CreateApplicationRequestValidator : AbstractValidator<CreateApplicationRequest>
{
    public CreateApplicationRequestValidator()
    {
        RuleFor(r => r.Id).NotEmpty();
        RuleFor(r => r.UnitId).NotEmpty();
    }
}

public sealed class AddApplicantRequestValidator : AbstractValidator<AddApplicantRequest>
{
    public AddApplicantRequestValidator() =>
        RuleFor(r => r.Email)
            .NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.");
}

public sealed class ReviewRequestValidator : AbstractValidator<ReviewRequest>
{
    public ReviewRequestValidator()
    {
        RuleFor(r => r.Outcome).IsInEnum();
        RuleFor(r => r.Comment)
            .NotEmpty().When(r => r.Outcome is ReviewOutcome.Return or ReviewOutcome.Deny)
            .WithMessage("A comment is required to return or deny an application.")
            .MaximumLength(2000);
    }
}

public sealed class WithdrawRequestValidator : AbstractValidator<WithdrawRequest>
{
    public WithdrawRequestValidator() => RuleFor(r => r.Reason).MaximumLength(500);
}

public sealed class UpdateNotesRequestValidator : AbstractValidator<UpdateNotesRequest>
{
    public UpdateNotesRequestValidator()
    {
        RuleFor(r => r.Text).MaximumLength(4000).WithMessage("Notes must be at most 4000 characters.");
        RuleFor(r => r.Version).GreaterThanOrEqualTo(0);
    }
}

public sealed class ApplicationListQueryValidator : AbstractValidator<ApplicationListQuery>
{
    public ApplicationListQueryValidator()
    {
        RuleFor(q => q.Page).GreaterThanOrEqualTo(1);
        RuleFor(q => q.PageSize).InclusiveBetween(1, 100);
        RuleFor(q => q.SortBy).IsInEnum();
        RuleFor(q => q.SortDir).IsInEnum();
    }
}

internal static class ValidationPatterns
{
    /// <summary>7–15 digits with an optional leading +, plus spaces, dots, dashes and parentheses.</summary>
    public const string Phone = @"^(?=(?:\D*\d){7,15}\D*$)\+?[0-9 ().-]{7,25}$";
}
