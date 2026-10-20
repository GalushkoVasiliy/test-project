using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Rentals.Domain.Applications;
using Rentals.Domain.Leasing;
using Rentals.Domain.Properties;
using Rentals.Infrastructure.Identity;

namespace Rentals.Infrastructure.Persistence;

public class AppDbContext(DbContextOptions<AppDbContext> options) : IdentityDbContext<AppUser>(options)
{
    public DbSet<Property> Properties => Set<Property>();

    public DbSet<Unit> Units => Set<Unit>();

    public DbSet<UnitType> UnitTypes => Set<UnitType>();

    public DbSet<Lease> Leases => Set<Lease>();

    public DbSet<RentalApplication> Applications => Set<RentalApplication>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(typeof(AppDbContext).Assembly);
    }
}
