namespace Rentals.Api.Common;

/// <summary>One page of rows plus the total number of rows matching the filters.</summary>
public sealed record PagedResult<T>(IReadOnlyList<T> Items, int TotalCount, int Page, int PageSize);

public enum SortDirection
{
    Asc,
    Desc,
}
