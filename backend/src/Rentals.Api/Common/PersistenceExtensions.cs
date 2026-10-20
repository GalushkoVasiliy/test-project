using System.Linq.Expressions;
using Microsoft.Data.SqlClient;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace Rentals.Api.Common;

public static class PersistenceExtensions
{
    public static DateOnly Today(this TimeProvider clock) => DateOnly.FromDateTime(clock.GetUtcNow().UtcDateTime);

    /// <summary>
    /// Optimistic concurrency: rejects the change when the client edited an older version, and makes
    /// SQL Server re-check the row version on save to cover the window between this read and the write.
    /// </summary>
    public static void ExpectVersion<T>(this EntityEntry<T> entry, Expression<Func<T, byte[]>> rowVersion, string clientVersion)
        where T : class
    {
        var expected = Versions.Decode(clientVersion);
        var property = entry.Property(rowVersion);
        if (!property.CurrentValue.AsSpan().SequenceEqual(expected))
        {
            throw ConcurrencyConflictException.Default();
        }

        property.OriginalValue = expected;
    }

    public static bool IsUniqueKeyViolation(this DbUpdateException exception) =>
        exception.InnerException is SqlException { Number: 2627 or 2601 };
}
