using Microsoft.EntityFrameworkCore;
using Rentals.Api.Common;
using Rentals.Domain.Applications;
using Rentals.Domain.Common;
using Rentals.Domain.Leasing;
using Rentals.Domain.Properties;
using Rentals.Infrastructure.Persistence;

namespace Rentals.Api.Features.Properties;

public sealed class PropertyService(AppDbContext db, TimeProvider clock)
{
    public async Task<IReadOnlyList<PropertySummaryDto>> ListAsync(CancellationToken ct)
    {
        var activeLease = Lease.CoversDate(clock.Today());

        return await db.Properties.AsNoTracking()
            .Where(p => p.DeletedAt == null)
            .OrderBy(p => p.Name)
            .Select(p => new PropertySummaryDto(
                p.Id,
                p.Name,
                p.Address,
                p.City,
                p.Units.Count(u => u.DeletedAt == null),
                p.Units.Count(u => u.DeletedAt == null && !u.Leases.AsQueryable().Any(activeLease)),
                Versions.Encode(p.RowVersion)))
            .ToListAsync(ct);
    }

    public async Task<PropertyDetailsDto> GetAsync(Guid id, CancellationToken ct)
    {
        var property = await db.Properties.AsNoTracking()
            .Where(p => p.Id == id && p.DeletedAt == null)
            .Select(p => new { p.Id, p.Name, p.Address, p.City, p.RowVersion })
            .FirstOrDefaultAsync(ct)
            ?? throw new NotFoundException("Property not found.");

        var units = await UnitQueries.Project(
                db,
                db.Units.Where(u => u.PropertyId == id && u.DeletedAt == null).OrderBy(u => u.UnitNumber),
                clock.Today())
            .ToListAsync(ct);

        return new PropertyDetailsDto(property.Id, property.Name, property.Address, property.City, Versions.Encode(property.RowVersion), units);
    }

    /// <summary>Idempotent: replaying a create with the same id returns the existing property.</summary>
    public async Task<(PropertyDetailsDto Property, bool Created)> CreateAsync(CreatePropertyRequest request, CancellationToken ct)
    {
        if (await db.Properties.AnyAsync(p => p.Id == request.Id, ct))
        {
            return (await GetAsync(request.Id, ct), false);
        }

        db.Properties.Add(new Property(request.Id, request.Name, request.Address, request.City, clock.GetUtcNow()));
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueKeyViolation())
        {
            // A concurrent replay of the same create won the race.
            db.ChangeTracker.Clear();
            return (await GetAsync(request.Id, ct), false);
        }

        return (await GetAsync(request.Id, ct), true);
    }

    public async Task<PropertyDetailsDto> UpdateAsync(Guid id, UpdatePropertyRequest request, CancellationToken ct)
    {
        var property = await db.Properties.FirstOrDefaultAsync(p => p.Id == id && p.DeletedAt == null, ct)
            ?? throw new NotFoundException("Property not found.");

        db.Entry(property).ExpectVersion(p => p.RowVersion, request.Version);
        property.Update(request.Name, request.Address, request.City, clock.GetUtcNow());
        await db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    /// <summary>Soft delete, blocked while any unit has an open application or a current or upcoming lease.</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var property = await db.Properties.Include(p => p.Units).FirstOrDefaultAsync(p => p.Id == id, ct)
            ?? throw new NotFoundException("Property not found.");
        if (property.IsDeleted)
        {
            return;
        }

        var unitIds = property.Units.Select(u => u.Id).ToList();
        if (await UnitQueries.AnyInUseAsync(db, unitIds, clock.Today(), ct))
        {
            throw DomainErrors.PropertyInUse();
        }

        property.Remove(clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
    }
}
