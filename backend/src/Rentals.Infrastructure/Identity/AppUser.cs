using Microsoft.AspNetCore.Identity;

namespace Rentals.Infrastructure.Identity;

public class AppUser : IdentityUser
{
    public string FullName { get; set; } = string.Empty;
}
