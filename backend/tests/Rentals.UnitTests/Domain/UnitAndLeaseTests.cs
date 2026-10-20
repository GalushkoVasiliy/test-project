using Rentals.Domain.Common;
using Rentals.Domain.Leasing;
using static Rentals.UnitTests.TestData;

namespace Rentals.UnitTests.Domain;

public class UnitAndLeaseTests
{
    [Fact]
    public void An_inactive_unit_type_cannot_be_selected_for_a_new_unit()
    {
        var error = Assert.Throws<DomainException>(() => Unit(InactiveType()));

        Assert.Equal("unit_type_inactive", error.Code);
        Assert.Equal("unitTypeId", error.Field);
    }

    [Fact]
    public void A_unit_keeps_its_type_after_that_type_is_deactivated()
    {
        var type = ActiveType();
        var unit = Unit(type);
        type.Deactivate();

        unit.Update("102", 3, 2100m, type, Now);

        Assert.Equal(type.Id, unit.UnitTypeId);
        Assert.Equal(3, unit.Bedrooms);
    }

    [Fact]
    public void An_existing_unit_cannot_be_switched_to_an_inactive_type()
    {
        var unit = Unit(ActiveType(1));

        var error = Assert.Throws<DomainException>(() => unit.Update("101", 2, 1800m, InactiveType(), Now));

        Assert.Equal("unit_type_inactive", error.Code);
        Assert.Equal(1, unit.UnitTypeId);
    }

    [Fact]
    public void A_unit_is_unavailable_only_while_a_lease_covers_the_date()
    {
        var unit = Unit();
        var leaseStart = Today.AddDays(10);
        Approved(unit, leaseStart);

        Assert.True(unit.IsAvailableOn(Today));
        Assert.False(unit.IsAvailableOn(leaseStart));
        Assert.False(unit.IsAvailableOn(leaseStart.AddMonths(12).AddDays(-1)));
        Assert.True(unit.IsAvailableOn(leaseStart.AddMonths(12)));
    }

    [Fact]
    public void A_removed_unit_is_not_available()
    {
        var unit = Unit();

        unit.Remove(Now);

        Assert.False(unit.IsAvailableOn(Today));
    }

    [Fact]
    public void A_lease_runs_for_twelve_months_inclusive()
    {
        var lease = Lease.Create(Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 3, 1));

        Assert.Equal(new DateOnly(2027, 2, 28), lease.EndDate);
        Assert.True(lease.Covers(new DateOnly(2026, 3, 1)));
        Assert.True(lease.Covers(new DateOnly(2027, 2, 28)));
        Assert.False(lease.Covers(new DateOnly(2026, 2, 28)));
        Assert.False(lease.Covers(new DateOnly(2027, 3, 1)));
    }

    [Theory]
    [InlineData("2026-01-01", "2026-02-28", false)]
    [InlineData("2026-01-01", "2026-03-01", true)]
    [InlineData("2027-02-28", "2027-06-01", true)]
    [InlineData("2027-03-01", "2027-06-01", false)]
    public void Overlap_detection_uses_inclusive_dates(string start, string end, bool overlaps)
    {
        var lease = Lease.Create(Guid.NewGuid(), Guid.NewGuid(), new DateOnly(2026, 3, 1));

        Assert.Equal(overlaps, lease.Overlaps(DateOnly.Parse(start), DateOnly.Parse(end)));
    }
}
