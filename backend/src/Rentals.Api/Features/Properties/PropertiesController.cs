using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Rentals.Api.Auth;

namespace Rentals.Api.Features.Properties;

[ApiController]
[Route("api/properties")]
[Produces("application/json")]
public sealed class PropertiesController(PropertyService properties, UnitService units) : ControllerBase
{
    /// <summary>Lists properties. Available to both roles (applicants use it to filter their applications).</summary>
    [HttpGet]
    public Task<IReadOnlyList<PropertySummaryDto>> List(CancellationToken ct) => properties.ListAsync(ct);

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<PropertyDetailsDto> Get(Guid id, CancellationToken ct) => properties.GetAsync(id, ct);

    /// <summary>Creates a property. Replaying the request with the same id returns 200 with the existing property.</summary>
    [HttpPost]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType<PropertyDetailsDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<PropertyDetailsDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<PropertyDetailsDto>> Create(CreatePropertyRequest request, CancellationToken ct)
    {
        var (property, created) = await properties.CreateAsync(request, ct);
        return created ? CreatedAtAction(nameof(Get), new { id = property.Id }, property) : Ok(property);
    }

    /// <summary>Updates a property. Returns 409 when <c>version</c> is not the latest one.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<PropertyDetailsDto> Update(Guid id, UpdatePropertyRequest request, CancellationToken ct) =>
        properties.UpdateAsync(id, request, ct);

    /// <summary>Removes a property and its units. Returns 409 while a unit has an open application or lease.</summary>
    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await properties.DeleteAsync(id, ct);
        return NoContent();
    }

    /// <summary>Adds a unit. Replaying the request with the same id returns 200 with the existing unit.</summary>
    [HttpPost("{propertyId:guid}/units")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType<UnitDto>(StatusCodes.Status201Created)]
    [ProducesResponseType<UnitDto>(StatusCodes.Status200OK)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    public async Task<ActionResult<UnitDto>> CreateUnit(Guid propertyId, CreateUnitRequest request, CancellationToken ct)
    {
        var (unit, created) = await units.CreateAsync(propertyId, request, ct);
        return created ? CreatedAtAction(nameof(UnitsController.Get), "Units", new { id = unit.Id }, unit) : Ok(unit);
    }
}

[ApiController]
[Route("api/units")]
[Produces("application/json")]
public sealed class UnitsController(UnitService units) : ControllerBase
{
    /// <summary>Units without a lease covering today, for applicants to browse.</summary>
    [HttpGet("available")]
    public Task<IReadOnlyList<AvailableUnitDto>> Available([FromQuery] AvailableUnitsQuery query, CancellationToken ct) =>
        units.ListAvailableAsync(query, ct);

    [HttpGet("{id:guid}")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public Task<UnitDto> Get(Guid id, CancellationToken ct) => units.GetAsync(id, ct);

    /// <summary>Updates a unit. An inactive unit type can be kept but not newly selected. Returns 409 on a stale version.</summary>
    [HttpPut("{id:guid}")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType<ValidationProblemDetails>(StatusCodes.Status400BadRequest)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public Task<UnitDto> Update(Guid id, UpdateUnitRequest request, CancellationToken ct) => units.UpdateAsync(id, request, ct);

    [HttpDelete("{id:guid}")]
    [Authorize(Policy = Policies.ManagerOnly)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Delete(Guid id, CancellationToken ct)
    {
        await units.DeleteAsync(id, ct);
        return NoContent();
    }
}

[ApiController]
[Route("api/lookups")]
[Produces("application/json")]
public sealed class LookupsController(UnitService units) : ControllerBase
{
    /// <summary>All unit types, including inactive ones (still shown on units that use them).</summary>
    [HttpGet("unit-types")]
    public Task<IReadOnlyList<UnitTypeDto>> UnitTypes(CancellationToken ct) => units.ListUnitTypesAsync(ct);
}
