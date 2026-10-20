using FluentValidation;

namespace Rentals.Api.Auth;

public enum UserRole
{
    Applicant,
    PropertyManager,
}

public sealed record RegisterRequest(string Email, string Password, string FullName, UserRole Role);

public sealed record LoginRequest(string Email, string Password);

public sealed record RefreshRequest(string RefreshToken);

public sealed record CurrentUserResponse(string Id, string Email, string FullName, UserRole Role);

public sealed class RegisterRequestValidator : AbstractValidator<RegisterRequest>
{
    public RegisterRequestValidator()
    {
        RuleFor(r => r.Email).NotEmpty().WithMessage("Email is required.")
            .EmailAddress().WithMessage("Enter a valid email address.")
            .MaximumLength(256);
        RuleFor(r => r.Password).NotEmpty().WithMessage("Password is required.")
            .MinimumLength(8).WithMessage("Password must be at least 8 characters.");
        RuleFor(r => r.FullName).NotEmpty().WithMessage("Full name is required.").MaximumLength(100);
        RuleFor(r => r.Role).IsInEnum();
    }
}

public sealed class LoginRequestValidator : AbstractValidator<LoginRequest>
{
    public LoginRequestValidator()
    {
        RuleFor(r => r.Email).NotEmpty().WithMessage("Email is required.");
        RuleFor(r => r.Password).NotEmpty().WithMessage("Password is required.");
    }
}

public sealed class RefreshRequestValidator : AbstractValidator<RefreshRequest>
{
    public RefreshRequestValidator() => RuleFor(r => r.RefreshToken).NotEmpty();
}
