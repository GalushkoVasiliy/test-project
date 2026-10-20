using Bogus;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using Rentals.Domain.Applications;
using Rentals.Domain.Common;
using Rentals.Domain.Properties;
using Rentals.Domain.Users;
using Rentals.Infrastructure.Identity;

namespace Rentals.Infrastructure.Persistence.Seeding;

/// <summary>
/// Idempotent seeding: every step checks what already exists, so running it on every start is safe.
/// Data is generated with Bogus from a fixed seed, so every environment gets the same demo data.
/// Applications are built through the domain model, which keeps their history and leases consistent.
/// </summary>
public sealed class DatabaseSeeder(
    AppDbContext db,
    UserManager<AppUser> userManager,
    RoleManager<IdentityRole> roleManager,
    TimeProvider clock,
    ILogger<DatabaseSeeder> logger)
{
    public const string DemoPassword = "Demo123!";

    private const int RandomSeed = 20261020;

    private static readonly UnitType[] UnitTypes =
    [
        new(1, "Studio", isActive: true),
        new(2, "Apartment", isActive: true),
        new(3, "Duplex", isActive: true),
        new(4, "Townhouse", isActive: true),
        new(5, "Penthouse", isActive: true),
        new(6, "Loft (legacy)", isActive: false),
    ];

    public async Task SeedAsync(CancellationToken ct = default)
    {
        var faker = new Faker("en") { Random = new Randomizer(RandomSeed) };

        await SeedRolesAsync();
        await SeedUnitTypesAsync(ct);

        var managers = await EnsureUsersAsync(Roles.PropertyManager,
        [
            ("manager@demo.test", "Morgan Reyes"),
            ("manager2@demo.test", "Jordan Blake"),
        ]);
        var applicants = await EnsureUsersAsync(Roles.Applicant,
        [
            ("applicant@demo.test", "Alex Carter"),
            ("applicant2@demo.test", "Sam Taylor"),
            .. Enumerable.Range(3, 4).Select(i => ($"applicant{i}@demo.test", faker.Name.FullName())),
        ]);

        await SeedPortfolioAsync(faker, managers, applicants, ct);
    }

    private async Task SeedRolesAsync()
    {
        foreach (var role in Roles.All)
        {
            if (!await roleManager.RoleExistsAsync(role))
            {
                await roleManager.CreateAsync(new IdentityRole(role));
            }
        }
    }

    private async Task SeedUnitTypesAsync(CancellationToken ct)
    {
        var existingIds = await db.UnitTypes.Select(t => t.Id).ToListAsync(ct);
        foreach (var type in UnitTypes.Where(t => !existingIds.Contains(t.Id)))
        {
            db.UnitTypes.Add(new UnitType(type.Id, type.Name, type.IsActive));
        }

        await db.SaveChangesAsync(ct);
    }

    private async Task<IReadOnlyList<AppUser>> EnsureUsersAsync(string role, IEnumerable<(string Email, string FullName)> users)
    {
        var result = new List<AppUser>();
        foreach (var (email, fullName) in users)
        {
            var user = await userManager.FindByEmailAsync(email);
            if (user is null)
            {
                user = new AppUser { UserName = email, Email = email, EmailConfirmed = true, FullName = fullName };
                var created = await userManager.CreateAsync(user, DemoPassword);
                if (!created.Succeeded)
                {
                    throw new InvalidOperationException(
                        $"Could not seed user {email}: {string.Join("; ", created.Errors.Select(e => e.Description))}");
                }
            }

            if (!await userManager.IsInRoleAsync(user, role))
            {
                await userManager.AddToRoleAsync(user, role);
            }

            result.Add(user);
        }

        return result;
    }

    private async Task SeedPortfolioAsync(
        Faker faker,
        IReadOnlyList<AppUser> managers,
        IReadOnlyList<AppUser> applicants,
        CancellationToken ct)
    {
        if (await db.Properties.AnyAsync(ct))
        {
            logger.LogInformation("Seed data already present, skipping portfolio seeding");
            return;
        }

        await using var transaction = await db.Database.BeginTransactionAsync(ct);

        var now = clock.GetUtcNow();
        var types = await db.UnitTypes.ToDictionaryAsync(t => t.Id, ct);

        // The legacy type was in use before it was retired, so some existing units still carry it.
        var legacy = types[6];
        legacy.Activate();
        var units = CreateProperties(faker, types, now.AddMonths(-24));
        legacy.Deactivate();
        await db.SaveChangesAsync(ct);

        var applications = new ApplicationFactory(faker);
        var reviewer = ToActor(managers[0]);
        var otherReviewer = ToActor(managers[1]);
        var alex = ToActor(applicants[0]);
        var others = applicants.Skip(1).Select(ToActor).ToList();

        var queue = new Queue<Unit>(faker.Random.Shuffle(units));

        // A lease that has already ended: the unit is available again.
        var expired = queue.Dequeue();
        db.Applications.Add(applications.Approved(expired, others[0], reviewer, now.AddDays(-430), leaseStartOffsetDays: 7));
        db.Applications.Add(applications.Submitted(expired, others[1], now.AddDays(-6)));

        // One application in every status for the main demo applicant.
        var leased = queue.Dequeue();
        db.Applications.Add(applications.Approved(leased, alex, reviewer, now.AddDays(-80), leaseStartOffsetDays: 14));
        // Another open application on a unit that is now leased: submit and approval must be rejected.
        db.Applications.Add(applications.Submitted(leased, others[2], now.AddDays(-82)));

        // A shared draft: Sam is a co-applicant and can edit it too.
        var shared = applications.Draft(queue.Dequeue(), alex, now.AddDays(-1), saveApplicantInfo: true);
        shared.AddCoApplicant(alex, others[0].Id, now.AddDays(-1).AddMinutes(20));
        db.Applications.Add(shared);
        db.Applications.Add(applications.IncompleteDraft(queue.Dequeue(), alex, now.AddHours(-5)));
        db.Applications.Add(applications.Draft(queue.Dequeue(), alex, now.AddHours(-3), saveApplicantInfo: false));
        db.Applications.Add(applications.Submitted(queue.Dequeue(), alex, now.AddDays(-4)));
        db.Applications.Add(applications.UnderReview(queue.Dequeue(), alex, otherReviewer, now.AddDays(-5)));
        db.Applications.Add(applications.Returned(queue.Dequeue(), alex, reviewer, now.AddDays(-9)));
        db.Applications.Add(applications.Denied(queue.Dequeue(), alex, reviewer, now.AddDays(-20)));
        db.Applications.Add(applications.Withdrawn(queue.Dequeue(), alex, now.AddDays(-15)));

        // A spread of applications from the other applicants, competing for some of the same units.
        var contested = queue.Dequeue();
        db.Applications.Add(applications.Submitted(contested, others[0], now.AddDays(-3)));
        db.Applications.Add(applications.Submitted(contested, others[3], now.AddDays(-2)));
        db.Applications.Add(applications.Resubmitted(queue.Dequeue(), others[1], reviewer, now.AddDays(-12)));
        db.Applications.Add(applications.Approved(queue.Dequeue(), others[2], otherReviewer, now.AddDays(-150), leaseStartOffsetDays: 30));
        db.Applications.Add(applications.Denied(queue.Dequeue(), others[3], otherReviewer, now.AddDays(-30)));
        db.Applications.Add(applications.Returned(queue.Dequeue(), others[2], otherReviewer, now.AddDays(-7)));
        db.Applications.Add(applications.Withdrawn(queue.Dequeue(), others[0], now.AddDays(-40)));
        db.Applications.Add(applications.Draft(queue.Dequeue(), others[1], now.AddDays(-2), saveApplicantInfo: true));

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        logger.LogInformation("Seeded {Units} units and {Applications} applications", units.Count, db.ChangeTracker.Entries<RentalApplication>().Count());
    }

    private List<Unit> CreateProperties(Faker faker, IReadOnlyDictionary<int, UnitType> types, DateTimeOffset createdAt)
    {
        var suffixes = new[] { "Residences", "Apartments", "Commons", "Lofts", "Tower", "Gardens" };
        var units = new List<Unit>();

        for (var p = 0; p < 6; p++)
        {
            var property = new Property(
                faker.Random.Guid(),
                $"{faker.Address.StreetName()} {faker.PickRandom(suffixes)}",
                faker.Address.StreetAddress(),
                faker.Address.City(),
                createdAt.AddDays(p * 7));
            db.Properties.Add(property);

            var floors = faker.Random.Int(2, 4);
            foreach (var floor in Enumerable.Range(1, floors))
            {
                foreach (var door in Enumerable.Range(1, faker.Random.Int(2, 3)))
                {
                    var type = PickType(faker, types);
                    var bedrooms = type.Id == 1 ? 0 : faker.Random.Int(1, type.Id == 5 ? 4 : 3);
                    var rent = Math.Round((850 + bedrooms * 450 + faker.Random.Int(0, 600)) / 25m) * 25m;
                    var unit = new Unit(
                        faker.Random.Guid(),
                        property.Id,
                        $"{floor}{door:00}",
                        bedrooms,
                        rent,
                        type,
                        property.CreatedAt);
                    db.Units.Add(unit);
                    units.Add(unit);
                }
            }
        }

        return units;
    }

    private static UnitType PickType(Faker faker, IReadOnlyDictionary<int, UnitType> types) =>
        types[faker.Random.WeightedRandom([1, 2, 3, 4, 5, 6], [0.2f, 0.4f, 0.1f, 0.1f, 0.05f, 0.15f])];

    private static Actor ToActor(AppUser user) => new(user.Id, user.FullName);

    /// <summary>Builds applications in a given status by replaying the workflow at historical times.</summary>
    private sealed class ApplicationFactory(Faker faker)
    {
        private static readonly string[] ReturnReasons =
        [
            "Please add your landlord's phone number for the previous residence.",
            "Residence history must cover at least the last two years.",
            "The current address does not match the ID provided — please correct it.",
        ];

        private static readonly string[] DenialReasons =
        [
            "Income requirements for this unit are not met.",
            "Unable to verify rental history with previous landlords.",
        ];

        public RentalApplication Draft(Unit unit, Actor applicant, DateTimeOffset startedAt, bool saveApplicantInfo)
        {
            var application = RentalApplication.Start(faker.Random.Guid(), unit, applicant, Day(startedAt), startedAt);
            if (saveApplicantInfo)
            {
                application.SaveApplicantInfo(applicant, ApplicantInfo(applicant), 0, startedAt.AddMinutes(10));
            }

            return application;
        }

        /// <summary>Sections saved as drafts that still have errors, so submission is blocked.</summary>
        public RentalApplication IncompleteDraft(Unit unit, Actor applicant, DateTimeOffset startedAt)
        {
            var application = RentalApplication.Start(faker.Random.Guid(), unit, applicant, Day(startedAt), startedAt);
            application.SaveApplicantInfo(applicant, new ApplicantInfo(applicant.Name, "555-01", null, null), 0, startedAt.AddMinutes(5));
            application.SaveResidences(applicant,
            [
                new ResidenceData(faker.Random.Guid(), $"{faker.Address.StreetAddress()}, {faker.Address.City()}", null, null,
                    Day(startedAt).AddYears(-2), null),
            ], 0, startedAt.AddMinutes(10));
            return application;
        }

        public RentalApplication Submitted(Unit unit, Actor applicant, DateTimeOffset startedAt)
        {
            var application = Draft(unit, applicant, startedAt, saveApplicantInfo: true);
            application.SaveResidences(applicant, Residences(startedAt), 0, startedAt.AddMinutes(25));
            application.Submit(applicant, Day(startedAt), startedAt.AddMinutes(30));
            return application;
        }

        public RentalApplication UnderReview(Unit unit, Actor applicant, Actor reviewer, DateTimeOffset startedAt)
        {
            var application = Submitted(unit, applicant, startedAt);
            application.Claim(reviewer, startedAt.AddDays(1));
            application.UpdateManagerNotes("Called the previous landlord — waiting for a call back.", 0);
            return application;
        }

        public RentalApplication Returned(Unit unit, Actor applicant, Actor reviewer, DateTimeOffset startedAt)
        {
            var application = Submitted(unit, applicant, startedAt);
            application.Claim(reviewer, startedAt.AddDays(1));
            application.CompleteReview(reviewer, ReviewOutcome.Return, faker.PickRandom(ReturnReasons), null,
                Day(startedAt.AddDays(1)), startedAt.AddDays(1).AddHours(2));
            return application;
        }

        public RentalApplication Resubmitted(Unit unit, Actor applicant, Actor reviewer, DateTimeOffset startedAt)
        {
            var application = Returned(unit, applicant, reviewer, startedAt);
            var at = startedAt.AddDays(3);
            application.SaveResidences(applicant, Residences(startedAt), application.ResidencesVersion, at);
            application.Submit(applicant, Day(at), at.AddMinutes(5));
            return application;
        }

        public RentalApplication Approved(Unit unit, Actor applicant, Actor reviewer, DateTimeOffset startedAt, int leaseStartOffsetDays)
        {
            var application = Submitted(unit, applicant, startedAt);
            var decidedAt = startedAt.AddDays(2);
            application.Claim(reviewer, startedAt.AddDays(1));
            application.CompleteReview(reviewer, ReviewOutcome.Approve, "Verified income and references.",
                Day(decidedAt).AddDays(leaseStartOffsetDays), Day(decidedAt), decidedAt);
            return application;
        }

        public RentalApplication Denied(Unit unit, Actor applicant, Actor reviewer, DateTimeOffset startedAt)
        {
            var application = Submitted(unit, applicant, startedAt);
            application.Claim(reviewer, startedAt.AddDays(1));
            application.CompleteReview(reviewer, ReviewOutcome.Deny, faker.PickRandom(DenialReasons), null,
                Day(startedAt.AddDays(2)), startedAt.AddDays(2));
            return application;
        }

        public RentalApplication Withdrawn(Unit unit, Actor applicant, DateTimeOffset startedAt)
        {
            var application = Submitted(unit, applicant, startedAt);
            application.Withdraw(applicant, "Found another place closer to work.", startedAt.AddDays(2));
            return application;
        }

        private ApplicantInfo ApplicantInfo(Actor applicant) => new(
            applicant.Name,
            faker.Phone.PhoneNumber("(###) ###-####"),
            $"{applicant.Name.ToLowerInvariant().Replace(' ', '.')}@example.com",
            $"{faker.Address.StreetAddress()}, {faker.Address.City()}");

        private List<ResidenceData> Residences(DateTimeOffset before)
        {
            var moveOut = Day(before).AddDays(-faker.Random.Int(5, 40));
            var result = new List<ResidenceData>();
            foreach (var _ in Enumerable.Range(0, faker.Random.Int(1, 3)))
            {
                var moveIn = moveOut.AddDays(-faker.Random.Int(240, 1100));
                result.Add(new ResidenceData(
                    faker.Random.Guid(),
                    $"{faker.Address.StreetAddress()}, {faker.Address.City()}",
                    faker.Name.FullName(),
                    faker.Phone.PhoneNumber("(###) ###-####"),
                    moveIn,
                    moveOut));
                moveOut = moveIn.AddDays(-faker.Random.Int(1, 20));
            }

            return result;
        }

        private static DateOnly Day(DateTimeOffset value) => DateOnly.FromDateTime(value.UtcDateTime);
    }
}
