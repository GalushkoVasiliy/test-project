using System.Linq.Expressions;

namespace Rentals.Domain.Leasing;

public class Lease
{
    public const int TermMonths = 12;

    private Lease() { }

    public Guid Id { get; private set; }

    public Guid UnitId { get; private set; }

    public Guid ApplicationId { get; private set; }

    public DateOnly StartDate { get; private set; }

    /// <summary>Last day of the lease, inclusive.</summary>
    public DateOnly EndDate { get; private set; }

    public static Lease Create(Guid unitId, Guid applicationId, DateOnly startDate) => new()
    {
        Id = Guid.NewGuid(),
        UnitId = unitId,
        ApplicationId = applicationId,
        StartDate = startDate,
        EndDate = startDate.AddMonths(TermMonths).AddDays(-1),
    };

    public bool Covers(DateOnly date) => StartDate <= date && date <= EndDate;

    public bool Overlaps(DateOnly start, DateOnly end) => StartDate <= end && start <= EndDate;

    /// <summary>Same rule as <see cref="Covers"/>, translatable to SQL.</summary>
    public static Expression<Func<Lease, bool>> CoversDate(DateOnly date) =>
        l => l.StartDate <= date && date <= l.EndDate;
}
