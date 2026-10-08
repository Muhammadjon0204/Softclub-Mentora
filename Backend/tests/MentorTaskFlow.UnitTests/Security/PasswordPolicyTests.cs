using MentorTaskFlow.Application.Common.Exceptions;
using MentorTaskFlow.Application.Common.Security;

namespace MentorTaskFlow.UnitTests.Security;

/// <summary>5 to 8 characters, any characters (product decision 2026-10-08).</summary>
public sealed class PasswordPolicyTests
{
    private static readonly PasswordPolicy Policy = new();

    [Theory]
    [InlineData("12345")]
    [InlineData("abcde")]
    [InlineData("AbC12!")]
    [InlineData("пароль12")]
    public void Any_five_to_eight_characters_are_accepted(string password)
    {
        Policy.Evaluate(password).ShouldBeEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData("1234")]
    [InlineData("123456789")]
    public void Shorter_or_longer_is_rejected(string password)
    {
        Policy.Evaluate(password).ShouldContain(e => e.Contains("от 5 до 8"));
    }

    [Fact]
    public void Null_is_rejected()
    {
        Policy.Evaluate(null).ShouldNotBeEmpty();
    }

    [Fact]
    public void Validate_throws_a_validation_error_on_the_named_field()
    {
        var exception = Should.Throw<ValidationAppException>(() => Policy.Validate("1", "newPassword"));

        exception.ShouldNotBeNull();
    }
}
