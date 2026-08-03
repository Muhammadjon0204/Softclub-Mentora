import {
  AUTH_ERROR_CODE,
  getProblemCode,
  getRetryAfter,
  getStatus,
  isNetworkError,
  type AuthErrorCode,
} from '../../api/problemDetails';

function pluralizeSeconds(value: number): string {
  const mod100 = value % 100;
  const mod10 = value % 10;
  if (mod100 >= 11 && mod100 <= 14) return 'секунд';
  if (mod10 === 1) return 'секунду';
  if (mod10 >= 2 && mod10 <= 4) return 'секунды';
  return 'секунд';
}

export function rateLimitMessage(seconds: number | null): string {
  if (seconds === null || seconds <= 0) {
    return 'Слишком много попыток. Попробуйте позже.';
  }
  return `Слишком много попыток. Повторите через ${String(seconds)} ${pluralizeSeconds(seconds)}.`;
}

/** У каждого известного кода — собственный текст. Общей заглушки для них нет. */
const MESSAGE_BY_CODE: Record<AuthErrorCode, string> = {
  // Единый текст на все причины отказа: не раскрываем, существует ли учётка,
  // заблокирована ли она и задан ли у неё пароль.
  INVALID_CREDENTIALS: 'Неверный email или пароль',
  RATE_LIMIT_EXCEEDED: 'Слишком много попыток. Попробуйте позже.',
  REFRESH_TOKEN_INVALID: 'Сессия истекла. Войдите заново.',
  REFRESH_TOKEN_REUSE_DETECTED: 'Сессия завершена по соображениям безопасности. Войдите заново.',
  CSRF_VALIDATION_FAILED: 'Проверка безопасности не пройдена. Обновите страницу и попробуйте снова.',
  UNAUTHORIZED: 'Требуется вход в систему.',
  TOKEN_EXPIRED: 'Сессия истекла. Войдите заново.',
  TOKEN_VERSION_MISMATCH: 'Сессия была завершена. Войдите заново.',
  VALIDATION_FAILED: 'Проверьте правильность заполнения полей.',
  SECURITY_TOKEN_INVALID: 'Ссылка недействительна или устарела',
  USER_DEACTIVATED: 'Учётная запись отключена. Обратитесь к администратору.',
};

interface MessageOptions {
  /** Активный countdown — важнее значения из заголовка. */
  retryAfterSeconds?: number | null;
}

export function getAuthErrorMessage(error: unknown, options: MessageOptions = {}): string {
  const code = getProblemCode(error);

  if (code === AUTH_ERROR_CODE.RATE_LIMIT_EXCEEDED) {
    return rateLimitMessage(options.retryAfterSeconds ?? getRetryAfter(error));
  }

  if (code !== null) return MESSAGE_BY_CODE[code];

  if (isNetworkError(error)) {
    return 'Нет соединения с сервером. Проверьте интернет и попробуйте снова.';
  }

  const status = getStatus(error);
  if (status !== null && status >= 500) {
    return 'Сервер временно недоступен. Попробуйте позже.';
  }

  // Сюда попадают только по-настоящему неизвестные ошибки — вместе с traceId.
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

/** Для неизвестных ошибок показываем traceId — с ним можно прийти в поддержку. */
export function shouldShowTraceId(error: unknown): boolean {
  return getProblemCode(error) === null && !isNetworkError(error);
}
