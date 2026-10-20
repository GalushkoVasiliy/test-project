namespace Rentals.Domain.Properties;

public class Property
{
    private readonly List<Unit> _units = [];

    private Property() { }

    public Property(Guid id, string name, string address, string city, DateTimeOffset now)
    {
        Id = id;
        CreatedAt = now;
        Update(name, address, city, now);
    }

    public Guid Id { get; private set; }

    public string Name { get; private set; } = null!;

    public string Address { get; private set; } = null!;

    public string City { get; private set; } = null!;

    public DateTimeOffset CreatedAt { get; private set; }

    public DateTimeOffset UpdatedAt { get; private set; }

    /// <summary>Soft delete: removed properties keep their history for existing applications and leases.</summary>
    public DateTimeOffset? DeletedAt { get; private set; }

    public byte[] RowVersion { get; private set; } = [];

    public IReadOnlyCollection<Unit> Units => _units;

    public bool IsDeleted => DeletedAt is not null;

    public void Update(string name, string address, string city, DateTimeOffset now)
    {
        Name = name.Trim();
        Address = address.Trim();
        City = city.Trim();
        UpdatedAt = now;
    }

    public void Remove(DateTimeOffset now)
    {
        if (IsDeleted)
        {
            return;
        }

        foreach (var unit in _units.Where(u => !u.IsDeleted))
        {
            unit.Remove(now);
        }

        DeletedAt = now;
        UpdatedAt = now;
    }
}
