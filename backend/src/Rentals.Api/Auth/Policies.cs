using Microsoft.AspNetCore.Authorization;
using Rentals.Domain.Users;

namespace Rentals.Api.Auth;

public static class Policies
{
    public const string ManagerOnly = nameof(ManagerOnly);
    public const string ApplicantOnly = nameof(ApplicantOnly);

    public static void Configure(AuthorizationOptions options)
    {
        options.AddPolicy(ManagerOnly, policy => policy.RequireRole(Roles.PropertyManager));
        options.AddPolicy(ApplicantOnly, policy => policy.RequireRole(Roles.Applicant));

        // Everything requires a signed-in user unless explicitly marked [AllowAnonymous].
        options.FallbackPolicy = new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build();
    }
}
