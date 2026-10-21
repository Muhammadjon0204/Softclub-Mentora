using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Common;
using Microsoft.Extensions.Logging;

namespace MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;

/// <summary>Turns the CRM client's failures into the API's: 503 with a reason the admin can act on.</summary>
internal static class CrmCall
{
    public static async Task<T> RunAsync<T>(OmuzCrmClient client, ILogger logger, Func<Task<T>> action)
    {
        if (!client.IsConfigured)
        {
            throw new ServiceUnavailableException(ErrorCodes.IntegrationNotConfigured, "Интеграция с CRM не настроена: нет ключа API.");
        }

        try
        {
            return await action();
        }
        catch (CrmUnauthorizedException exception)
        {
            throw new ServiceUnavailableException(ErrorCodes.IntegrationUnavailable, $"CRM не принимает ключ: {exception.Message}");
        }
        catch (Exception exception) when (exception is CrmUnavailableException or CrmRequestException)
        {
            logger.LogWarning(exception, "CRM call failed.");
            throw new ServiceUnavailableException(ErrorCodes.IntegrationUnavailable, exception.Message);
        }
    }
}
