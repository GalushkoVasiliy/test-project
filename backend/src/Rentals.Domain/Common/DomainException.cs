namespace Rentals.Domain.Common;

/// <summary>
/// A business rule was violated. <see cref="Code"/> is a stable, machine-readable identifier the
/// client can rely on; <see cref="Field"/> is set when the violation belongs to a specific input field.
/// </summary>
public class DomainException(string code, string message, string? field = null) : Exception(message)
{
    public string Code { get; } = code;

    public string? Field { get; } = field;
}
