namespace Rentals.Api.Common;

/// <summary>Thrown when a resource does not exist or the caller is not allowed to know it exists.</summary>
public sealed class NotFoundException(string message) : Exception(message);

/// <summary>Thrown when the caller's state is stale (optimistic concurrency).</summary>
public sealed class ConcurrencyConflictException(string message) : Exception(message)
{
    public const string Code = "concurrency_conflict";

    public static ConcurrencyConflictException Default() =>
        new("This record was changed by someone else. Reload to see the latest version and try again.");
}

/// <summary>Input failed validation; errors are keyed by the JSON path of the offending field.</summary>
public sealed class RequestValidationException(IDictionary<string, string[]> errors, string code = "validation_failed")
    : Exception("One or more validation errors occurred.")
{
    public IDictionary<string, string[]> Errors { get; } = errors;

    public string Code { get; } = code;
}
