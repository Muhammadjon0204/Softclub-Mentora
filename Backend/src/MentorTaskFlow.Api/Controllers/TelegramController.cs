using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using MentorTaskFlow.Api.Authentication;
using MentorTaskFlow.Api.Authorization;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Contracts.Telegram;
using MentorTaskFlow.Infrastructure.Options;
using MentorTaskFlow.Infrastructure.Telegram;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.Api.Controllers;

/// <summary>
/// Telegram account binding and the bot webhook (Приложение D.8, TZ 19).
/// </summary>
/// <remarks>
/// The bot performs no business actions: work cannot be approved or returned by a chat command
/// (<c>TG-004</c>). It carries notifications and binds accounts, and an unrecognised command gets a
/// help reply — a chat is not an authenticated context, and treating it as one would put the whole
/// authorisation model behind a message anyone can send.
/// </remarks>
[ApiController]
[Route("api/v1/telegram")]
[Produces("application/json")]
public sealed class TelegramController(
    ITelegramService telegram,
    TelegramUpdateHandler updates,
    IOptions<TelegramOptions> options) : ControllerBase
{
    private readonly TelegramOptions _options = options.Value;

    /// <summary>
    /// <c>POST /telegram/bind-token</c> — a one-time token and its deep link.
    /// </summary>
    /// <remarks>
    /// The response is the only place the plain token exists. Issuing a new one retires the previous
    /// (<c>TG-006</c>), and the endpoint is limited to five requests an hour per user (<c>TG-014</c>).
    /// </remarks>
    [HttpPost("bind-token")]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<TelegramBindTokenDto>(StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    [ProducesResponseType(StatusCodes.Status429TooManyRequests)]
    public async Task<ActionResult<TelegramBindTokenDto>> IssueBindTokenAsync(CancellationToken cancellationToken)
    {
        EnsureEnabled();

        var token = await telegram.IssueBindTokenAsync(cancellationToken);

        // The token is a bearer secret for the next fifteen minutes; no cache may keep it (TG-013).
        Response.Headers.CacheControl = "no-store";

        return StatusCode(StatusCodes.Status201Created, token);
    }

    /// <summary><c>POST /telegram/test</c> — sends a test message to the caller's own chat and reports the outcome.</summary>
    [HttpPost("test")]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<TelegramTestResultDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TelegramTestResultDto>> SendTestAsync(CancellationToken cancellationToken)
    {
        EnsureEnabled();

        return Ok(await telegram.SendTestAsync(cancellationToken));
    }

    [HttpGet("status")]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType<TelegramStatusDto>(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<ActionResult<TelegramStatusDto>> GetStatusAsync(CancellationToken cancellationToken)
    {
        EnsureEnabled();

        return Ok(await telegram.GetStatusAsync(cancellationToken));
    }

    /// <summary>
    /// <c>DELETE /telegram/binding</c> — 204, and notifications fall back to email (<c>NTF-002</c>).
    /// </summary>
    [HttpDelete("binding")]
    [Authorize(Policy = MtfPolicies.Authenticated)]
    [ProducesResponseType(StatusCodes.Status204NoContent)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> UnbindAsync(CancellationToken cancellationToken)
    {
        EnsureEnabled();

        await telegram.UnbindAsync(cancellationToken);

        return NoContent();
    }

    /// <summary>
    /// <c>POST /telegram/webhook</c> — anonymous to the outside world, guarded by a shared secret.
    /// </summary>
    /// <remarks>
    /// <para>
    /// The secret header is the only thing separating Telegram from anyone who has guessed the URL, so
    /// it is compared in constant time and a mismatch answers 401 with no body at all (<c>TG-002</c>):
    /// a body would tell a prober that the endpoint exists and cares about the header.
    /// </para>
    /// <para>
    /// The reply is always 200. Telegram retries anything else, and a retry of a message we have
    /// already understood — a wrong token, say — would achieve nothing but load.
    /// </para>
    /// </remarks>
    [HttpPost("webhook")]
    [AllowAnonymous]
    [EnableRateLimiting(RateLimitPolicies.TelegramWebhook)]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<IActionResult> WebhookAsync(
        [FromBody] JsonElement update,
        CancellationToken cancellationToken)
    {
        if (!_options.Enabled || !HasValidSecret())
        {
            // The status is written directly and an empty result returned: every ordinary way of
            // producing a 401 in an [ApiController] attaches a ProblemDetails body, and TG-002
            // requires none — a body tells a prober that the endpoint exists and cares about the
            // header it just failed to present.
            Response.StatusCode = StatusCodes.Status401Unauthorized;

            return new EmptyResult();
        }

        // Answered inline: Telegram executes the sendMessage in the response body, so the reply costs
        // no second call. Long polling sends the very same reply with an explicit call instead.
        var reply = await updates.HandleAsync(update, cancellationToken);

        return reply is null ? Ok() : Ok(reply.ToWebhookResponse());
    }

    private bool HasValidSecret()
    {
        if (string.IsNullOrEmpty(_options.WebhookSecret))
        {
            return false;
        }

        var presented = Request.Headers["X-Telegram-Bot-Api-Secret-Token"].ToString();

        return CryptographicOperations.FixedTimeEquals(
            Encoding.UTF8.GetBytes(presented),
            Encoding.UTF8.GetBytes(_options.WebhookSecret));
    }

    private void EnsureEnabled()
    {
        if (!_options.Enabled)
        {
            throw new NotFoundException();
        }
    }
}
