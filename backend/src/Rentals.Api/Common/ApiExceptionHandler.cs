using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Rentals.Domain.Common;

namespace Rentals.Api.Common;

/// <summary>
/// Maps exceptions to RFC 7807 problem responses. Every problem carries a stable <c>code</c> extension
/// so the mobile client can tell a rejected change (e.g. a stale edit) from a transient failure.
/// </summary>
public sealed class ApiExceptionHandler(IProblemDetailsService problemDetails, ILogger<ApiExceptionHandler> logger)
    : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext context, Exception exception, CancellationToken ct)
    {
        ProblemDetails? problem = exception switch
        {
            RequestValidationException e => Validation(e.Errors, e.Code),
            DomainException { Field: not null } e => Validation(new Dictionary<string, string[]> { [e.Field] = [e.Message] }, e.Code),
            DomainException e => Problem(StatusCodes.Status409Conflict, "The request conflicts with the current state.", e.Message, e.Code),
            DbUpdateConcurrencyException => Problem(StatusCodes.Status409Conflict, "Concurrency conflict",
                ConcurrencyConflictException.Default().Message, ConcurrencyConflictException.Code),
            ConcurrencyConflictException e => Problem(StatusCodes.Status409Conflict, "Concurrency conflict", e.Message, ConcurrencyConflictException.Code),
            NotFoundException e => Problem(StatusCodes.Status404NotFound, "Not found", e.Message, "not_found"),
            _ => null,
        };

        if (problem is null)
        {
            return false;
        }

        logger.LogInformation("Request rejected with {Status} {Code}: {Message}",
            problem.Status, problem.Extensions["code"], exception.Message);

        context.Response.StatusCode = problem.Status!.Value;
        return await problemDetails.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            ProblemDetails = problem,
            Exception = exception,
        });
    }

    private static ValidationProblemDetails Validation(IDictionary<string, string[]> errors, string code = "validation_failed")
    {
        var problem = new ValidationProblemDetails(errors)
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more validation errors occurred.",
            Detail = errors.Values.SelectMany(v => v).FirstOrDefault(),
        };
        problem.Extensions["code"] = code;
        return problem;
    }

    private static ProblemDetails Problem(int status, string title, string detail, string code)
    {
        var problem = new ProblemDetails { Status = status, Title = title, Detail = detail };
        problem.Extensions["code"] = code;
        return problem;
    }
}
