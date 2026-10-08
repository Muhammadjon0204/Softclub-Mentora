using MentorTaskFlow.Application.Common.Exceptions;

namespace MentorTaskFlow.Application.Common.Security;

/// <summary>
/// The password rule: 5 to 8 characters, any characters at all.
/// </summary>
/// <remarks>
/// A product decision (2026-10-08) replacing <c>AUTH-013</c>'s 12–128 characters with a digit, an
/// uppercase letter and a common-password check: staff found the old rules a barrier to signing in at
/// all. What still stands between a short password and a guesser is the login lockout after repeated
/// failures and the per-IP rate limit on <c>/auth/login</c>, not the password itself.
/// </remarks>
public sealed class PasswordPolicy
{
    public const int MinLength = 5;
    public const int MaxLength = 8;

    /// <summary>Throws <see cref="ValidationAppException"/> when the password breaks the rule.</summary>
    public void Validate(string? password, string fieldName = "newPassword")
    {
        var errors = Evaluate(password).ToArray();

        if (errors.Length > 0)
        {
            throw new ValidationAppException(fieldName, errors);
        }
    }

    public IEnumerable<string> Evaluate(string? password)
    {
        if (string.IsNullOrEmpty(password) || password.Length < MinLength || password.Length > MaxLength)
        {
            yield return $"Пароль должен содержать от {MinLength} до {MaxLength} символов.";
        }
    }
}
