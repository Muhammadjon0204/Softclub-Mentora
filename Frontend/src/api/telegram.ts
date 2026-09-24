import { apiClient } from './client';

/** `Backend/src/MentorTaskFlow.Contracts/Telegram/TelegramDtos.cs`. */
export interface TelegramBindTokenDto {
  token: string;
  deepLink: string;
  expiresAt: string;
}

export interface TelegramStatusDto {
  isBound: boolean;
  boundAt: string | null;
}

/** POST /telegram/bind-token — 201, план ссылки живёт 15 минут (TG-013). */
export async function issueTelegramBindToken(): Promise<TelegramBindTokenDto> {
  const { data } = await apiClient.post<TelegramBindTokenDto>('/api/v1/telegram/bind-token');
  return data;
}

/** GET /telegram/status */
export async function getTelegramStatus(): Promise<TelegramStatusDto> {
  const { data } = await apiClient.get<TelegramStatusDto>('/api/v1/telegram/status');
  return data;
}

/** DELETE /telegram/binding — 204, дальнейшие уведомления идут на email (NTF-002). */
export async function unbindTelegram(): Promise<void> {
  await apiClient.delete('/api/v1/telegram/binding');
}
