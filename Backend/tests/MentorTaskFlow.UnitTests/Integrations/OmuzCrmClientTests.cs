using System.Net;
using System.Text;
using MentorTaskFlow.Infrastructure.Integrations.OmuzCrm;
using MentorTaskFlow.Infrastructure.Options;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.Extensions.Options;

namespace MentorTaskFlow.UnitTests.Integrations;

/// <summary>The CRM's two ways of reporting failure, its pages and its transient errors.</summary>
public sealed class OmuzCrmClientTests
{
    private const string Key = "crm_test_key";

    private sealed class FakeHandler(Func<HttpRequestMessage, int, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public List<HttpRequestMessage> Requests { get; } = [];

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Requests.Add(request);
            return Task.FromResult(respond(request, Requests.Count));
        }
    }

    private sealed class FakeFactory(HttpMessageHandler handler) : IHttpClientFactory
    {
        public HttpClient CreateClient(string name) => new(handler, disposeHandler: false) { BaseAddress = new Uri("https://crm.test/api/integration/v1/") };
    }

    private static HttpResponseMessage Json(string body, HttpStatusCode status = HttpStatusCode.OK) =>
        new(status) { Content = new StringContent(body, Encoding.UTF8, "application/json") };

    private static (OmuzCrmClient Client, FakeHandler Handler) Create(Func<HttpRequestMessage, int, HttpResponseMessage> respond, string? key = Key)
    {
        var handler = new FakeHandler(respond);
        var options = Options.Create(new OmuzCrmOptions { ApiKey = key, MinRequestIntervalMs = 0, PageSize = 2 });
        return (new OmuzCrmClient(new FakeFactory(handler), options, NullLogger<OmuzCrmClient>.Instance), handler);
    }

    [Fact]
    public async Task The_key_travels_in_its_header()
    {
        var (client, handler) = Create((_, _) => Json("""{"data":{"keyName":"Mentora","serverTime":"2026-10-20T03:40:59+00:00"},"statusCode":200,"errors":[]}"""));

        var ping = await client.PingAsync(CancellationToken.None);

        ping!.KeyName.ShouldBe("Mentora");
        handler.Requests.Single().Headers.GetValues("X-Api-Key").ShouldBe([Key]);
        handler.Requests.Single().RequestUri!.ToString().ShouldBe("https://crm.test/api/integration/v1/ping");
    }

    /// <summary>«Group not found» arrives as HTTP 200 with 404 in the body — that is «nothing», not an error.</summary>
    [Fact]
    public async Task A_not_found_in_the_body_is_null()
    {
        var (client, _) = Create((_, _) => Json("""{"data":null,"statusCode":404,"errors":["Группа не найдена."]}"""));

        (await client.GetGroupAsync(999, CancellationToken.None)).ShouldBeNull();
    }

    [Fact]
    public async Task A_rejected_request_in_the_body_is_an_error()
    {
        var (client, _) = Create((_, _) => Json("""{"data":null,"statusCode":400,"errors":["The value '9' is invalid."]}"""));

        var exception = await Should.ThrowAsync<CrmRequestException>(client.ListGroupsAsync(9, CancellationToken.None));
        exception.Message.ShouldContain("invalid");
    }

    /// <summary>Key problems are a real HTTP 401 — and are not retried.</summary>
    [Fact]
    public async Task A_refused_key_is_an_unauthorized_error()
    {
        var (client, handler) = Create((_, _) => Json("""{"statusCode":401,"errors":["API-ключ заблокирован."]}""", HttpStatusCode.Unauthorized));

        var exception = await Should.ThrowAsync<CrmUnauthorizedException>(client.PingAsync(CancellationToken.None));
        exception.Message.ShouldBe("API-ключ заблокирован.");
        handler.Requests.Count.ShouldBe(1);
    }

    [Fact]
    public async Task Every_page_is_read()
    {
        var (client, handler) = Create((request, _) => request.RequestUri!.Query.Contains("PageNumber=1", StringComparison.Ordinal)
            ? Json("""{"pageNumber":1,"pageSize":2,"totalPages":2,"totalRecords":3,"data":[{"id":1,"name":"Profsouz"},{"id":2,"name":"B"}],"statusCode":200,"errors":[]}""")
            : Json("""{"pageNumber":2,"pageSize":2,"totalPages":2,"totalRecords":3,"data":[{"id":3,"name":"C"}],"statusCode":200,"errors":[]}"""));

        var mentors = await client.ListMentorsAsync(CancellationToken.None);

        handler.Requests.Count.ShouldBe(2);
        mentors.Count.ShouldBe(3);
        handler.Requests[0].RequestUri!.Query.ShouldBe("?PageNumber=1&PageSize=2");
    }

    [Fact]
    public async Task A_server_error_is_retried()
    {
        var (client, handler) = Create((_, attempt) => attempt == 1
            ? new HttpResponseMessage(HttpStatusCode.BadGateway)
            : Json("""{"data":[{"id":4,"name":"React"}],"statusCode":200,"errors":[]}"""));

        (await client.GetCoursesAsync(CancellationToken.None)).ShouldHaveSingleItem().Name.ShouldBe("React");
        handler.Requests.Count.ShouldBe(2);
    }

    [Fact]
    public async Task Without_a_key_nothing_is_sent()
    {
        var (client, handler) = Create((_, _) => Json("{}"), key: null);

        client.IsConfigured.ShouldBeFalse();
        await Should.ThrowAsync<InvalidOperationException>(client.PingAsync(CancellationToken.None));
        handler.Requests.ShouldBeEmpty();
    }
}
