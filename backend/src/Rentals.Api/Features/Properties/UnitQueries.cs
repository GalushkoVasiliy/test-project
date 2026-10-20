using Microsoft.EntityFrameworkCore;
using Rentals.Api.Common;
using Rentals.Domain.Applications;
using Rentals.Domain.Leasing;
using Rentals.Domain.Properties;
using Rentals.Infrastructure.Persistence;

namespace Rentals.Api.Features.Properties;

internal static class UnitQueries
{
    public static IQueryable<UnitDto> Project(AppDbContext db, IQueryable<Unit> units, DateOnly today)
    {
        var activeLease = Lease.CoversDate(today);
        var openStatuses = ApplicationWorkflow.OpenStatuses;

        return units.AsNoTracking().Select(u => new UnitDto(
            u.Id,
            u.PropertyId,
            u.UnitNumber,
            u.Bedrooms,
            u.MonthlyRent,
            u.UnitTypeId,
            u.UnitType.Name,
            u.UnitType.IsActive,
            !u.Leases.AsQueryable().Any(activeLease),
            u.Leases
                .Where(l => l.EndDate >= today)
                .OrderBy(l => l.StartDate)
                .Select(l => new LeaseDto(l.Id, l.ApplicationId, l.StartDate, l.EndDate))
                .FirstOrDefault(),
            db.Applications.Count(a => a.UnitId == u.Id && openStatuses.Contains(a.Status)),
            Versions.Encode(u.RowVersion)));
    }

    /// <summary>A unit is in use while it has an open application or a current or upcoming lease.</summary>
    public static async Task<bool> AnyInUseAsync(AppDbContext db, IReadOnlyCollection<Guid> unitIds, DateOnly today, CancellationToken ct)
    {
        var openStatuses = ApplicationWorkflow.OpenStatuses;
        return await db.Applications.AnyAsync(a => unitIds.Contains(a.UnitId) && openStatuses.Contains(a.Status), ct)
            || await db.Leases.AnyAsync(l => unitIds.Contains(l.UnitId) && l.EndDate >= today, ct);
    }
}
