namespace Rentals.Domain.Applications;

/// <summary>Another applicant on the application, with the same rights as the primary applicant.</summary>
public class CoApplicant
{
    private CoApplicant() { }

    public Guid ApplicationId { get; private set; }

    public string UserId { get; private set; } = null!;

    public string AddedById { get; private set; } = null!;

    public DateTimeOffset AddedAt { get; private set; }

    internal static CoApplicant Create(Guid applicationId, string userId, string addedById, DateTimeOffset at) => new()
    {
        ApplicationId = applicationId,
        UserId = userId,
        AddedById = addedById,
        AddedAt = at,
    };
}
