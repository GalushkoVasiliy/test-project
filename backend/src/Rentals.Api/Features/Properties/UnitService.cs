using Microsoft.EntityFrameworkCore;
using Rentals.Api.Common;
using Rentals.Domain.Common;
using Rentals.Domain.Leasing;
using Rentals.Domain.Properties;
using Rentals.Infrastructure.Persistence;

namespace Rentals.Api.Features.Properties;

public sealed class UnitService(AppDbContext db, TimeProvider clock)
{
    public async Task<IReadOnlyList<AvailableUnitDto>> ListAvailableAsync(AvailableUnitsQuery query, CancellationToken ct)
    {
        var activeLease = Lease.CoversDate(clock.Today());

        var units = db.Units.AsNoTracking()
            .Where(u => u.DeletedAt == null && u.Property.DeletedAt == null)
            .Where(u => !u.Leases.AsQueryable().Any(activeLease));

        if (query.PropertyId is { } propertyId)
        {
            units = units.Where(u => u.PropertyId == propertyId);
        }

        if (query.MinBedrooms is { } minBedrooms)
        {
            units = units.Where(u => u.Bedrooms >= minBedrooms);
        }

        if (query.MaxRent is { } maxRent)
        {
            units = units.Where(u => u.MonthlyRent <= maxRent);
        }

        return await units
            .OrderBy(u => u.Property.Name)
            .ThenBy(u => u.UnitNumber)
            .Select(u => new AvailableUnitDto(
                u.Id,
                u.PropertyId,
                u.Property.Name,
                u.Property.Address,
                u.Property.City,
                u.UnitNumber,
                u.Bedrooms,
                u.MonthlyRent,
                u.UnitType.Name))
            .ToListAsync(ct);
    }

    public async Task<UnitDto> GetAsync(Guid id, CancellationToken ct) =>
        await UnitQueries.Project(db, db.Units.Where(u => u.Id == id && u.DeletedAt == null), clock.Today()).FirstOrDefaultAsync(ct)
        ?? throw new NotFoundException("Unit not found.");

    /// <summary>Idempotent: replaying a create with the same id returns the existing unit.</summary>
    public async Task<(UnitDto Unit, bool Created)> CreateAsync(Guid propertyId, CreateUnitRequest request, CancellationToken ct)
    {
        if (await db.Units.AnyAsync(u => u.Id == request.Id, ct))
        {
            return (await GetAsync(request.Id, ct), false);
        }

        if (!await db.Properties.AnyAsync(p => p.Id == propertyId && p.DeletedAt == null, ct))
        {
            throw new NotFoundException("Property not found.");
        }

        var unitType = await FindUnitTypeAsync(request.UnitTypeId, ct);
        await EnsureUniqueNumberAsync(propertyId, request.UnitNumber, request.Id, ct);

        db.Units.Add(new Unit(request.Id, propertyId, request.UnitNumber, request.Bedrooms, request.MonthlyRent, unitType, clock.GetUtcNow()));
        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException ex) when (ex.IsUniqueKeyViolation())
        {
            // Either a concurrent replay of this create won the race, or another unit took the number.
            db.ChangeTracker.Clear();
            if (await db.Units.AnyAsync(u => u.Id == request.Id, ct))
            {
                return (await GetAsync(request.Id, ct), false);
            }

            await EnsureUniqueNumberAsync(propertyId, request.UnitNumber, request.Id, ct);
            throw;
        }

        return (await GetAsync(request.Id, ct), true);
    }

    public async Task<UnitDto> UpdateAsync(Guid id, UpdateUnitRequest request, CancellationToken ct)
    {
        var unit = await db.Units.Include(u => u.UnitType).FirstOrDefaultAsync(u => u.Id == id && u.DeletedAt == null, ct)
            ?? throw new NotFoundException("Unit not found.");

        db.Entry(unit).ExpectVersion(u => u.RowVersion, request.Version);
        var unitType = await FindUnitTypeAsync(request.UnitTypeId, ct);
        await EnsureUniqueNumberAsync(unit.PropertyId, request.UnitNumber, unit.Id, ct);

        unit.Update(request.UnitNumber, request.Bedrooms, request.MonthlyRent, unitType, clock.GetUtcNow());
        await db.SaveChangesAsync(ct);

        return await GetAsync(id, ct);
    }

    /// <summary>Soft delete, blocked while the unit has an open application or a current or upcoming lease.</summary>
    public async Task DeleteAsync(Guid id, CancellationToken ct)
    {
        var unit = await db.Units.FirstOrDefaultAsync(u => u.Id == id, ct)
            ?? throw new NotFoundException("Unit not found.");
        if (unit.IsDeleted)
        {
            return;
        }

        if (await UnitQueries.AnyInUseAsync(db, [unit.Id], clock.Today(), ct))
        {
            throw DomainErrors.UnitInUse();
        }

        unit.Remove(clock.GetUtcNow());
        await db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<UnitTypeDto>> ListUnitTypesAsync(CancellationToken ct) =>
        await db.UnitTypes.AsNoTracking()
            .OrderBy(t => t.Id)
            .Select(t => new UnitTypeDto(t.Id, t.Name, t.IsActive))
            .ToListAsync(ct);

    private async Task<UnitType> FindUnitTypeAsync(int id, CancellationToken ct) =>
        await db.UnitTypes.FirstOrDefaultAsync(t => t.Id == id, ct)
        ?? throw new RequestValidationException(new Dictionary<string, string[]> { ["unitTypeId"] = ["Select a valid unit type."] });

    private async Task EnsureUniqueNumberAsync(Guid propertyId, string unitNumber, Guid unitId, CancellationToken ct)
    {
        var number = unitNumber.Trim();
        if (await db.Units.AnyAsync(u => u.PropertyId == propertyId && u.UnitNumber == number && u.DeletedAt == null && u.Id != unitId, ct))
        {
            throw new RequestValidationException(new Dictionary<string, string[]>
            {
                ["unitNumber"] = [$"Unit {number} already exists in this property."],
            });
        }
    }
}
