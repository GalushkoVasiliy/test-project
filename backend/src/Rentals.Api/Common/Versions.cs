namespace Rentals.Api.Common;

/// <summary>Concurrency tokens travel to the client as opaque base64 strings.</summary>
public static class Versions
{
    public static string Encode(byte[] rowVersion) => Convert.ToBase64String(rowVersion);

    public static byte[] Decode(string version)
    {
        try
        {
            return Convert.FromBase64String(version);
        }
        catch (FormatException)
        {
            throw ConcurrencyConflictException.Default();
        }
    }
}
