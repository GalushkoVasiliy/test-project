using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;

namespace Rentals.Api.Common;

/// <summary>Documents bearer authentication so requests can be authorized from Swagger UI.</summary>
internal sealed class BearerSecuritySchemeTransformer : IOpenApiDocumentTransformer
{
    private const string SchemeName = "Bearer";

    public Task TransformAsync(OpenApiDocument document, OpenApiDocumentTransformerContext context, CancellationToken ct)
    {
        document.Info = new OpenApiInfo
        {
            Title = "Rentals API",
            Version = "v1",
            Description = "Property rental management: properties, units, rental applications, reviews and leases. "
                + "Sign in with POST /api/auth/login and use the access token as a Bearer token.",
        };

        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[SchemeName] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            In = ParameterLocation.Header,
            Description = "Access token returned by /api/auth/login, /api/auth/register or /api/auth/refresh.",
        };

        document.Security ??= [];
        document.Security.Add(new OpenApiSecurityRequirement
        {
            [new OpenApiSecuritySchemeReference(SchemeName, document)] = [],
        });

        return Task.CompletedTask;
    }
}
