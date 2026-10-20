namespace Rentals.Domain.Applications;

/// <summary>Applicant Information. Values may be missing or invalid while the section is a draft.</summary>
public sealed record ApplicantInfo(string? FullName, string? Phone, string? Email, string? CurrentAddress)
{
    /// <summary>A new, empty instance (owned entities must not be shared between applications).</summary>
    public static ApplicantInfo Blank() => new(null, null, null, null);

    internal ApplicantInfo Normalized() => new(
        Text.Clean(FullName),
        Text.Clean(Phone),
        Text.Clean(Email),
        Text.Clean(CurrentAddress));
}

internal static class Text
{
    /// <summary>Trims the value; blank becomes null.</summary>
    public static string? Clean(string? value) => string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
