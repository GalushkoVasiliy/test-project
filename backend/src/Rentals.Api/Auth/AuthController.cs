using Microsoft.AspNetCore.Authentication.BearerToken;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using Rentals.Api.Common;
using Rentals.Domain.Users;
using Rentals.Infrastructure.Identity;

namespace Rentals.Api.Auth;

/// <summary>
/// Sign-up, sign-in and token refresh on top of the standard ASP.NET Identity user store and the
/// Identity bearer token handler. The token response body is written by the bearer handler itself.
/// </summary>
[ApiController]
[Route("api/auth")]
[Produces("application/json")]
public sealed class AuthController(
    UserManager<AppUser> userManager,
    SignInManager<AppUser> signInManager,
    IOptionsMonitor<BearerTokenOptions> bearerTokenOptions,
    TimeProvider clock) : ControllerBase
{
    [HttpPost("register")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim();
        var user = new AppUser { UserName = email, Email = email, FullName = request.FullName.Trim() };

        var created = await userManager.CreateAsync(user, request.Password);
        if (!created.Succeeded)
        {
            throw new RequestValidationException(ToValidationErrors(created));
        }

        await userManager.AddToRoleAsync(user, request.Role == UserRole.PropertyManager ? Roles.PropertyManager : Roles.Applicant);

        signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
        await signInManager.SignInAsync(user, isPersistent: false);
        return new EmptyResult();
    }

    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType<ProblemDetails>(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        signInManager.AuthenticationScheme = IdentityConstants.BearerScheme;
        var result = await signInManager.PasswordSignInAsync(request.Email.Trim(), request.Password, isPersistent: false, lockoutOnFailure: true);
        if (!result.Succeeded)
        {
            return Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "Sign-in failed",
                detail: result.IsLockedOut
                    ? "Too many failed attempts. Try again in a few minutes."
                    : "The email or password is incorrect.");
        }

        return new EmptyResult();
    }

    [HttpPost("refresh")]
    [AllowAnonymous]
    [ProducesResponseType<AccessTokenResponse>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> Refresh(RefreshRequest request)
    {
        var protector = bearerTokenOptions.Get(IdentityConstants.BearerScheme).RefreshTokenProtector;
        var ticket = protector.Unprotect(request.RefreshToken);

        if (ticket?.Properties.ExpiresUtc is not { } expiresAt
            || clock.GetUtcNow() >= expiresAt
            || await signInManager.ValidateSecurityStampAsync(ticket.Principal) is not { } user)
        {
            return Challenge(IdentityConstants.BearerScheme);
        }

        var principal = await signInManager.CreateUserPrincipalAsync(user);
        return SignIn(principal, IdentityConstants.BearerScheme);
    }

    [HttpGet("me")]
    [ProducesResponseType<CurrentUserResponse>(StatusCodes.Status200OK)]
    public async Task<ActionResult<CurrentUserResponse>> Me()
    {
        var user = await userManager.GetUserAsync(User);
        if (user is null)
        {
            return Unauthorized();
        }

        var isManager = await userManager.IsInRoleAsync(user, Roles.PropertyManager);
        return new CurrentUserResponse(user.Id, user.Email!, user.FullName, isManager ? UserRole.PropertyManager : UserRole.Applicant);
    }

    private static Dictionary<string, string[]> ToValidationErrors(IdentityResult result) =>
        result.Errors
            .GroupBy(e => e.Code switch
            {
                _ when e.Code.StartsWith("Password", StringComparison.Ordinal) => "password",
                _ when e.Code.Contains("Email", StringComparison.Ordinal) || e.Code.Contains("UserName", StringComparison.Ordinal) => "email",
                _ => string.Empty,
            })
            .ToDictionary(
                g => g.Key,
                g => g.Select(e => e.Code is "DuplicateUserName" or "DuplicateEmail"
                    ? "An account with this email already exists."
                    : e.Description).Distinct().ToArray());
}
