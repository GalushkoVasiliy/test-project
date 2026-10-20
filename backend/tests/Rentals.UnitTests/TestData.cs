using Rentals.Domain.Applications;
using Rentals.Domain.Common;
using Rentals.Domain.Properties;

namespace Rentals.UnitTests;

internal static class TestData
{
    public static readonly DateTimeOffset Now = new(2026, 10, 20, 9, 0, 0, TimeSpan.Zero);
    public static readonly DateOnly Today = DateOnly.FromDateTime(Now.UtcDateTime);

    public static readonly Actor Applicant = new("applicant-1", "Alex Carter");
    public static readonly Actor OtherApplicant = new("applicant-2", "Sam Taylor");
    public static readonly Actor Manager = new("manager-1", "Morgan Reyes");
    public static readonly Actor OtherManager = new("manager-2", "Jordan Blake");

    public static UnitType ActiveType(int id = 1) => new(id, $"Type {id}", isActive: true);

    public static UnitType InactiveType(int id = 99) => new(id, "Legacy", isActive: false);

    public static Unit Unit(UnitType? type = null) =>
        new(Guid.NewGuid(), Guid.NewGuid(), "101", 2, 1800m, type ?? ActiveType(), Now.AddYears(-1));

    public static ApplicantInfo Info() => new("Alex Carter", "(555) 123-4567", "alex@example.com", "1 Main St, Springfield");

    public static ResidenceData Residence(Guid? id = null) => new(
        id ?? Guid.NewGuid(), "9 Elm St, Springfield", "Pat Landlord", "(555) 765-4321",
        Today.AddYears(-3), Today.AddMonths(-1));

    public static RentalApplication Draft(Unit? unit = null) =>
        RentalApplication.Start(Guid.NewGuid(), unit ?? Unit(), Applicant, Today, Now.AddHours(-5));

    public static RentalApplication Completed(Unit? unit = null)
    {
        var application = Draft(unit);
        application.SaveApplicantInfo(Applicant, Info(), 0, Now.AddHours(-4));
        application.SaveResidences(Applicant, [Residence()], 0, Now.AddHours(-4));
        return application;
    }

    public static RentalApplication Submitted(Unit? unit = null)
    {
        var application = Completed(unit);
        application.Submit(Applicant, Today, Now.AddHours(-3));
        return application;
    }

    public static RentalApplication UnderReview(Unit? unit = null, Actor? reviewer = null)
    {
        var application = Submitted(unit);
        application.Claim(reviewer ?? Manager, Now.AddHours(-2));
        return application;
    }

    public static RentalApplication Approved(Unit unit, DateOnly? leaseStart = null)
    {
        var application = UnderReview(unit);
        application.CompleteReview(Manager, ReviewOutcome.Approve, null, leaseStart ?? Today, Today, Now.AddHours(-1));
        return application;
    }
}

internal sealed class FixedClock(DateTimeOffset now) : TimeProvider
{
    public override DateTimeOffset GetUtcNow() => now;
}
