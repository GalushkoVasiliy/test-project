using Rentals.Domain.Common;
using Rentals.Domain.Leasing;

namespace Rentals.Domain.Properties;

public class Unit
{
    private readonly List<Lease> _leases = [];

    private Unit() { }

    public Unit(Guid id, Guid propertyId, string unitNumber, int bedrooms, decimal monthlyRent, UnitType unitType, DateTimeOffset now)
    {
        if (!unitType.IsActive)
        {
            throw DomainErrors.UnitTypeInactive(unitType.Name);
        }

        Id = id;
        PropertyId = propertyId;
        CreatedAt = now;
        Apply(unitNumber, bedrooms, monthlyRent, unitType, now);
    }

    public Guid Id { get; private set; }

    public Guid PropertyId { get; private set; }

    public Property Property { get; private set; } = null!;

    public string UnitNumber { get; private set; } = null!;

    public int Bedrooms { get; private set; }

    public decimal MonthlyRent { get; private set; }

    public int UnitTypeId { get; private set; }

    public UnitType UnitType { get; private set; } = null!;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>
    /// Set whenever a lease is issued. Touching the row bumps <see cref="RowVersion"/>, so two concurrent
    /// approvals for the same unit cannot both commit — the second fails the optimistic concurrency check.
    /// </summary>
    public DateTimeOffset? LastLeasedAt { get; private set; }

    public DateTimeOffset? DeletedAt { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public IReadOnlyCollection<Lease> Leases => _leases;

    public bool IsDeleted => DeletedAt is not null;

    public void Update(string unitNumber, int bedrooms, decimal monthlyRent, UnitType unitType, DateTimeOffset now)
    {
        // An inactive type may stay on a unit that already uses it, but cannot be newly selected.
        if (unitType.Id != UnitTypeId && !unitType.IsActive)
        {
            throw DomainErrors.UnitTypeInactive(unitType.Name);
        }

        Apply(unitNumber, bedrooms, monthlyRent, unitType, now);
    }

    public bool IsAvailableOn(DateOnly date) => !IsDeleted && !_leases.Any(l => l.Covers(date));

    internal Lease IssueLease(Guid applicationId, DateOnly startDate, DateOnly today, DateTimeOffset now)
    {
        if (_leases.Any(l => l.Covers(today)))
        {
            throw DomainErrors.UnitHasActiveLease();
        }

        var lease = Lease.Create(Id, applicationId, startDate);
        if (_leases.Any(l => l.Overlaps(lease.StartDate, lease.EndDate)))
        {
            throw DomainErrors.LeaseOverlaps();
        }

        _leases.Add(lease);
        LastLeasedAt = now;
        UpdatedAt = now;
        return lease;
    }

    public void Remove(DateTimeOffset now)
    {
        DeletedAt ??= now;
        UpdatedAt = now;
    }

    private void Apply(string unitNumber, int bedrooms, decimal monthlyRent, UnitType unitType, DateTimeOffset now)
    {
        UnitNumber = unitNumber.Trim();
        Bedrooms = bedrooms;
        MonthlyRent = monthlyRent;
        UnitTypeId = unitType.Id;
        UnitType = unitType;
        UpdatedAt = now;
    }
}
