using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using Rentals.Domain.Applications;
using Rentals.Domain.Leasing;
using Rentals.Infrastructure.Identity;

namespace Rentals.Infrastructure.Persistence.Configurations;

internal sealed class RentalApplicationConfiguration : IEntityTypeConfiguration<RentalApplication>
{
    public void Configure(EntityTypeBuilder<RentalApplication> builder)
    {
        builder.ToTable("Applications");
        builder.Property(a => a.Id).ValueGeneratedNever();
        builder.Property(a => a.Status).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.ManagerNotes).HasMaxLength(4000);
        builder.Property(a => a.ReviewerName).HasMaxLength(200);
        builder.Property(a => a.RowVersion).IsRowVersion();

        builder.HasOne(a => a.Unit)
            .WithMany()
            .HasForeignKey(a => a.UnitId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(a => a.ApplicantId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(a => a.ReviewerId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.HasOne<Lease>()
            .WithOne()
            .HasForeignKey<Lease>(l => l.ApplicationId)
            .OnDelete(DeleteBehavior.Restrict);

        builder.OwnsOne(a => a.ApplicantInfo, info =>
        {
            info.Property(i => i.FullName).HasMaxLength(100).HasColumnName("ApplicantFullName");
            info.Property(i => i.Phone).HasMaxLength(30).HasColumnName("ApplicantPhone");
            info.Property(i => i.Email).HasMaxLength(256).HasColumnName("ApplicantEmail");
            info.Property(i => i.CurrentAddress).HasMaxLength(200).HasColumnName("ApplicantCurrentAddress");
        });
        // Always present (all columns nullable): the section can be saved as an incomplete draft.
        builder.Navigation(a => a.ApplicantInfo).IsRequired();

        builder.HasMany(a => a.Residences)
            .WithOne()
            .HasForeignKey(r => r.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(a => a.Residences).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(a => a.CoApplicants)
            .WithOne()
            .HasForeignKey(c => c.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(a => a.CoApplicants).UsePropertyAccessMode(PropertyAccessMode.Field);

        builder.HasMany(a => a.History)
            .WithOne()
            .HasForeignKey(h => h.ApplicationId)
            .OnDelete(DeleteBehavior.Cascade);
        builder.Navigation(a => a.History).UsePropertyAccessMode(PropertyAccessMode.Field);

        // Supports the list screen filters and default sort.
        builder.HasIndex(a => new { a.Status, a.UpdatedAt });
        builder.HasIndex(a => new { a.ApplicantId, a.Status });
        builder.HasIndex(a => a.UnitId);
    }
}

internal sealed class ResidenceConfiguration : IEntityTypeConfiguration<Residence>
{
    public void Configure(EntityTypeBuilder<Residence> builder)
    {
        builder.ToTable("Residences");

        // Composite key: residence ids come from the client, so they are only unique within an application.
        builder.HasKey(r => new { r.ApplicationId, r.Id });
        builder.Property(r => r.Id).ValueGeneratedNever();
        builder.Property(r => r.Address).HasMaxLength(200);
        builder.Property(r => r.LandlordName).HasMaxLength(100);
        builder.Property(r => r.LandlordPhone).HasMaxLength(30);
    }
}

internal sealed class CoApplicantConfiguration : IEntityTypeConfiguration<CoApplicant>
{
    public void Configure(EntityTypeBuilder<CoApplicant> builder)
    {
        builder.ToTable("CoApplicants");
        builder.HasKey(c => new { c.ApplicationId, c.UserId });

        builder.HasOne<AppUser>()
            .WithMany()
            .HasForeignKey(c => c.UserId)
            .OnDelete(DeleteBehavior.Restrict);

        // "Applications I am on" is looked up by user.
        builder.HasIndex(c => c.UserId);
    }
}

internal sealed class ApplicationStatusChangeConfiguration : IEntityTypeConfiguration<ApplicationStatusChange>
{
    public void Configure(EntityTypeBuilder<ApplicationStatusChange> builder)
    {
        builder.ToTable("ApplicationStatusChanges");
        builder.Property(h => h.Id).ValueGeneratedNever();
        builder.Property(h => h.FromStatus).HasConversion<string>().HasMaxLength(20);
        builder.Property(h => h.ToStatus).HasConversion<string>().HasMaxLength(20);
        builder.Property(h => h.Outcome).HasConversion<string>().HasMaxLength(20);
        builder.Property(h => h.Comment).HasMaxLength(2000);
        builder.Property(h => h.ChangedByName).HasMaxLength(200);
        builder.HasIndex(h => new { h.ApplicationId, h.ChangedAt });
    }
}
