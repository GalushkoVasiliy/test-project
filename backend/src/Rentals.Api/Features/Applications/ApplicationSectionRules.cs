using FluentValidation;
using FluentValidation.Results;
using Rentals.Domain.Applications;

namespace Rentals.Api.Features.Applications;

public enum SectionStatus
{
    /// <summary>Never saved.</summary>
    Empty,

    /// <summary>Saved as a draft that still has errors.</summary>
    Incomplete,

    /// <summary>Saved and passes every rule.</summary>
    Complete,
}

public sealed record SectionCheck(SectionStatus Status, IReadOnlyDictionary<string, string[]> Errors);

public sealed record SectionsReview(SectionCheck ApplicantInfo, SectionCheck Residences)
{
    public bool IsComplete => ApplicantInfo.Status == SectionStatus.Complete && Residences.Status == SectionStatus.Complete;

    /// <summary>Everything that still blocks submission, keyed by field path.</summary>
    public Dictionary<string, string[]> BlockingErrors()
    {
        var errors = new Dictionary<string, string[]>();
        Add(ApplicantInfo, "applicantInfo", ApplicationSection.ApplicantInfo);
        Add(Residences, "residences", ApplicationSection.Residences);
        return errors;

        void Add(SectionCheck check, string path, ApplicationSection section)
        {
            if (check.Status == SectionStatus.Empty)
            {
                errors[path] = [$"{section.DisplayName()} has not been filled in yet."];
            }

            foreach (var (key, messages) in check.Errors)
            {
                errors[key] = messages;
            }
        }
    }
}

/// <summary>
/// Applies the section rules. Each rule is defined once (ApplicationValidators.cs) and used everywhere:
/// to reject Continue, to limit what a draft may store, to report the errors of a saved draft on every
/// read, and to block submission while any error remains. Errors are computed, never stored, so they
/// cannot drift from the rules.
/// </summary>
public sealed class ApplicationSectionRules(TimeProvider clock)
{
    private const string ApplicantInfoPath = "applicantInfo";

    private readonly ApplicantInfoLimits _applicantInfoLimits = new();
    private readonly ApplicantInfoRules _applicantInfoRules = new();
    private readonly ResidenceHistoryLimits _residenceLimits = new();
    private readonly ResidenceHistoryRules _residenceRules = new(clock);

    /// <summary>Limits only: what a draft must satisfy to be stored.</summary>
    public Dictionary<string, string[]> CheckLimits(ApplicantInfoInput input) =>
        Errors(ApplicantInfoPath, _applicantInfoLimits.Validate(input));

    public Dictionary<string, string[]> CheckLimits(IReadOnlyList<ResidenceInput> input) =>
        Errors(null, _residenceLimits.Validate(new ResidenceHistoryInput(input)));

    /// <summary>Limits and rules: what a complete section must satisfy.</summary>
    public Dictionary<string, string[]> Validate(ApplicantInfoInput input) =>
        Errors(ApplicantInfoPath, _applicantInfoLimits.Validate(input), _applicantInfoRules.Validate(input));

    public Dictionary<string, string[]> Validate(IReadOnlyList<ResidenceInput> input)
    {
        var history = new ResidenceHistoryInput(input);
        return Errors(null, _residenceLimits.Validate(history), _residenceRules.Validate(history));
    }

    /// <summary>The status and errors of each section as currently stored.</summary>
    public SectionsReview Review(RentalApplication application) => new(
        Check(application.ApplicantInfoVersion, () => Validate(ToInput(application.ApplicantInfo))),
        Check(application.ResidencesVersion, () => Validate(OrderedResidences(application).Select(ToInput).ToList())));

    /// <summary>The display order of residences; residence errors refer to items by their index in it.</summary>
    public static IReadOnlyList<Residence> OrderedResidences(RentalApplication application) =>
        application.Residences
            .OrderByDescending(r => r.MoveOutDate)
            .ThenBy(r => r.Id.ToString(), StringComparer.Ordinal)
            .ToList();

    private static SectionCheck Check(int version, Func<Dictionary<string, string[]>> validate)
    {
        if (version == 0)
        {
            return new SectionCheck(SectionStatus.Empty, new Dictionary<string, string[]>());
        }

        var errors = validate();
        return new SectionCheck(errors.Count == 0 ? SectionStatus.Complete : SectionStatus.Incomplete, errors);
    }

    private static ApplicantInfoInput ToInput(ApplicantInfo info) =>
        new(info.FullName, info.Phone, info.Email, info.CurrentAddress);

    private static ResidenceInput ToInput(Residence r) =>
        new(r.Id, r.Address, r.LandlordName, r.LandlordPhone, r.MoveInDate, r.MoveOutDate);

    private static Dictionary<string, string[]> Errors(string? prefix, params ValidationResult[] results) =>
        results
            .SelectMany(r => r.Errors)
            .GroupBy(e => prefix is null ? e.PropertyName : $"{prefix}.{e.PropertyName}")
            .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());
}
