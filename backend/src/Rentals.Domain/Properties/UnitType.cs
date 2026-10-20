namespace Rentals.Domain.Properties;

/// <summary>
/// Lookup value. Inactive types remain visible on units that already use them but cannot be
/// assigned to any other unit.
/// </summary>
public class UnitType
{
    private UnitType() { }

    public UnitType(int id, string name, bool isActive)
    {
        Id = id;
        Name = name;
        IsActive = isActive;
    }

    public int Id { get; private set; }

    public string Name { get; private set; } = null!;

    public bool IsActive { get; private set; }

    public void Deactivate() => IsActive = false;

    public void Activate() => IsActive = true;
}
