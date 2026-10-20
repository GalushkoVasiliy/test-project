using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rentals.Api.Auth;
using Rentals.Api.Common;

namespace Rentals.Api.Features.Applications;

[ApiController]
[Route("api/applications")]
[Produces("application/json")]
public sealed class ApplicationsController(ApplicationService applications) : ControllerBase
{
    /// <summary>
    /// One page of applications plus the filtered total. Applicants see their own applications,
    /// property managers see all of them. Filtering, sorting and paging run in the database.
    /// </summary>
    [HttpGet]
    public Task<PagedResult<ApplicationListItemDto>> List([FromQuery] ApplicationListQuery query, CancellationToken ct) =>
        applications.ListAsync(query, ct);

    /// <summary>The view model behind the application page.</summary>
    [HttpGet("{id:guid}")]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<ApplicationViewModel> Get(Guid id, CancellationToken ct) => applications.GetAsync(id, ct);

    /// <summary>Starts a draft for an available unit. Replaying with the same id returns 200 with the existing draft.</summary>
    [HttpPost]
    [Authorize(Policy = Policies.ApplicantOnly)]
    [ProducesResponseType<ApplicationViewModel>(StatusCodes.Status201Created)]
    [ProducesResponseType<ApplicationViewModel>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<ActionResult<ApplicationViewModel>> Create(CreateApplicationRequest request, CancellationToken ct)
    {
        var (application, created) = await applications.CreateAsync(request, ct);
        return created ? CreatedAtAction(nameof(Get), new { id = application.Id }, application) : Ok(application);
    }

    /// <summary>
    /// The application form's single action. <c>command</c> is the button that was pressed:
    /// <c>Continue</c> validates the posted section and saves it only when valid (400 with field errors
    /// otherwise); <c>SaveDraft</c> saves it as it is and returns its remaining errors in the view model;
    /// <c>Submit</c> submits from the Summary (400 <c>submission_blocked</c> listing every remaining error).
    /// A stale section <c>version</c> is rejected with 409.
    /// </summary>
    [HttpPost("{id:guid}/form")]
    [Authorize(Policy = Policies.ApplicantOnly)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationFormResult> Form(Guid id, ApplicationFormRequest request, CancellationToken ct) =>
        applications.SubmitFormAsync(id, request, ct);

    /// <summary>
    /// Adds an existing applicant account (by email) as a co-applicant. Everyone on an application can view,
    /// edit, submit and withdraw it. Adding someone who is already on it changes nothing.
    /// </summary>
    [HttpPost("{id:guid}/applicants")]
    [Authorize(Policy = Policies.ApplicantOnly)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationViewModel> AddApplicant(Guid id, AddApplicantRequest request, CancellationToken ct) =>
        applications.AddApplicantAsync(id, request, ct);

    /// <summary>
    /// Removes a co-applicant. The primary applicant can remove anyone else; a co-applicant can remove
    /// only themselves (leave the application).
    /// </summary>
    [HttpDelete("{id:guid}/applicants/{applicantId}")]
    [Authorize(Policy = Policies.ApplicantOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> RemoveApplicant(Guid id, string applicantId, CancellationToken ct)
    {
        await applications.RemoveApplicantAsync(id, applicantId, ct);
        return NoContent();
    }

    [HttpPost("{id:guid}/withdraw")]
    [Authorize(Policy = Policies.ApplicantOnly)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationViewModel> Withdraw(Guid id, WithdrawRequest request, CancellationToken ct) =>
        applications.WithdrawAsync(id, request, ct);

    /// <summary>Takes a submitted application from the review queue (status becomes UnderReview).</summary>
    [HttpPost("{id:guid}/claim")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationViewModel> Claim(Guid id, CancellationToken ct) => applications.ClaimAsync(id, ct);

    /// <summary>Puts a claimed application back in the review queue.</summary>
    [HttpPost("{id:guid}/release")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationViewModel> Release(Guid id, CancellationToken ct) => applications.ReleaseAsync(id, ct);

    /// <summary>
    /// Completes the review with Approve, Return or Deny (comment required for Return and Deny).
    /// Approval issues a twelve-month lease and is rejected when the unit has an active or overlapping lease.
    /// </summary>
    [HttpPost("{id:guid}/review")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationViewModel> Review(Guid id, ReviewRequest request, CancellationToken ct) =>
        applications.ReviewAsync(id, request, ct);

    /// <summary>Internal property manager notes. Never returned to applicants.</summary>
    [HttpPut("{id:guid}/notes")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<ApplicationViewModel> UpdateNotes(Guid id, UpdateNotesRequest request, CancellationToken ct) =>
        applications.UpdateNotesAsync(id, request, ct);
}
