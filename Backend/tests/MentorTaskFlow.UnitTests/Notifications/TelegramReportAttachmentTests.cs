using System.Net;
using System.Text;
using System.Text.Json;
using MentorTaskFlow.Application.Common.Abstractions;
using MentorTaskFlow.Domain.Notifications;
using MentorTaskFlow.Infrastructure.Options;
using MentorTaskFlow.Infrastructure.Telegram;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.UnitTests.Notifications;

/// <summary>A report's PDF follows its Telegram message; the message alone decides delivery.</summary>
public sealed class TelegramReportAttachmentTests
{
    private sealed class FakeHandler(Func<string, HttpStatusCode> respond) : HttpMessageHandler
    {
        public List<(string Method, string Body)> Calls { get; } = [];

        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            var method = request.RequestUri!.AbsolutePath.Split('/')[^1];
            Calls.Add((method, await request.Content!.ReadAsStringAsync(cancellationToken)));
            var status = respond(method);
            return new HttpResponseMessage(status) { Content = new StringContent("""{"ok":true,"result":{}}""", Encoding.UTF8, "application/json") };
        }
    }

    private sealed class FakeFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri("https://telegram.test") };
    }

    private sealed class FakeAttachments(ReportFile? file) : INotificationAttachmentProvider
    {
        public Task<ReportFile?> GetAsync(string eventType, JsonDocument payload, CancellationToken cancellationToken) =>
            Task.FromResult(file);
    }

    private static readonly ReportFile Pdf = new("Otchet-React-1-Неделя-6.pdf", "application/pdf", Encoding.ASCII.GetBytes("%PDF-1.7 test"));

    private static async Task<(DeliveryResult Result, FakeHandler Handler)> SendAsync(ReportFile? file, Func<string, HttpStatusCode>? respond = null)
    {
        var handler = new FakeHandler(respond ?? (_ => HttpStatusCode.OK));
        var sender = new TelegramNotificationSender(
            new FakeFactory(handler),
            Options.Create(new TelegramOptions { Enabled = true, BotToken = "123:test" }),
            Options.Create(new NotificationOptions { AppBaseUrl = "https://tms.example.tj" }),
            new FakeAttachments(file),
            NullLogger<TelegramNotificationSender>.Instance);

        var payload = JsonDocument.Parse("""
            {"reportId":"01a164b6-6032-79cd-90ba-fc349149445c","groupName":"React - 1","periodTitle":"неделю 6",
             "periodRange":"12–17 окт","leadNames":"Нигора","actionPath":"/mentor/crm?report=01a164b6-6032-79cd-90ba-fc349149445c"}
            """);
        var message = new NotificationMessage(NotificationEventTypes.CrmReportReceipt, "Умед Шарипов", null, "42", payload);

        return (await sender.SendAsync(message, CancellationToken.None), handler);
    }

    [Fact]
    public async Task The_pdf_follows_the_message()
    {
        var (result, handler) = await SendAsync(Pdf);

        result.Succeeded.ShouldBeTrue();
        handler.Calls.Select(c => c.Method).ShouldBe(["sendMessage", "sendDocument"]);
        var document = handler.Calls[1].Body;
        document.ShouldContain("name=chat_id");
        document.ShouldContain("42");
        document.ShouldContain("%PDF-1.7 test");
        document.ShouldContain("application/pdf");
    }

    [Fact]
    public async Task No_file_means_only_the_message()
    {
        var (result, handler) = await SendAsync(null);

        result.Succeeded.ShouldBeTrue();
        handler.Calls.Select(c => c.Method).ShouldBe(["sendMessage"]);
    }

    /// <summary>A retry would send the text twice, so a refused document leaves the delivery a success.</summary>
    [Fact]
    public async Task A_refused_document_does_not_fail_the_delivery()
    {
        var (result, handler) = await SendAsync(Pdf, method => method == "sendDocument" ? HttpStatusCode.BadRequest : HttpStatusCode.OK);

        result.Succeeded.ShouldBeTrue();
        handler.Calls.Count.ShouldBe(2);
    }

    [Fact]
    public async Task A_failed_message_sends_no_document()
    {
        var (result, handler) = await SendAsync(Pdf, _ => HttpStatusCode.InternalServerError);

        result.Succeeded.ShouldBeFalse();
        handler.Calls.Select(c => c.Method).ShouldBe(["sendMessage"]);
    }
}
