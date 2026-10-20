using System.Security.Claims;
using Rentals.Domain.Common;
using Rentals.Domain.Users;
using Rentals.Infrastructure.Identity;

namespace Rentals.Api.Auth;

public interface ICurrentUser
{
    string Id { get; }

    string Name { get; }

    bool IsManager { get; }

    Actor Actor { get; }
}

public sealed class CurrentUser(IHttpContextAccessor accessor) : ICurrentUser
{
    private ClaimsPrincipal Principal =>
        accessor.HttpContext?.User ?? throw new InvalidOperationException("No user is associated with the current request.");

    public string Id => Principal.FindFirstValue(ClaimTypes.NameIdentifier)
        ?? throw new InvalidOperationException("The current user has no identifier claim.");

    public string Name => Principal.FindFirstValue(AppUserClaimsPrincipalFactory.FullNameClaim)
        ?? Principal.Identity?.Name
        ?? Id;

    public bool IsManager => Principal.IsInRole(Roles.PropertyManager);

    public Actor Actor => new(Id, Name);
}
