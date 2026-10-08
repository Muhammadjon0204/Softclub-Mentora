import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { server } from '../mocks/server';
import { renderApp, trackRequests } from './utils';

const STRONG_PASSWORD = 'pass123';

async function fillPasswords(
  user: ReturnType<typeof renderApp>['user'],
  password: string,
): Promise<void> {
  await user.type(await screen.findByLabelText('Новый пароль'), password);
  await user.type(screen.getByLabelText('Повторите пароль'), password);
}

describe('Reset / Set password', () => {
  // 7
  it('просроченный reset-токен приводит к экрану «ссылка недействительна»', async () => {
    const { user } = renderApp('/reset-password?token=reset-expired-token');

    await fillPasswords(user, STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: /сохранить пароль/i }));

    expect(await screen.findByText(/Ссылка недействительна или устарела/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /запросить новую ссылку/i })).toBeInTheDocument();
  });

  it('использованный reset-токен даёт тот же экран', async () => {
    const { user } = renderApp('/reset-password?token=reset-used-token');

    await fillPasswords(user, STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: /сохранить пароль/i }));

    expect(await screen.findByText(/Ссылка недействительна или устарела/i)).toBeInTheDocument();
  });

  it('без query-параметра token запрос к API не отправляется вовсе', async () => {
    const requests = trackRequests(server);
    renderApp('/reset-password');

    expect(await screen.findByText(/Ссылка недействительна или устарела/i)).toBeInTheDocument();
    expect(requests.some((entry) => entry.includes('reset-password'))).toBe(false);
  });

  it('валидный reset-токен приводит к экрану успеха без auto-login', async () => {
    const { user } = renderApp('/reset-password?token=reset-valid-token');

    await fillPasswords(user, STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: /сохранить пароль/i }));

    expect(await screen.findByRole('heading', { name: 'Пароль обновлён' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /перейти ко входу/i })).toBeInTheDocument();
    // Auto-login запрещён: на дашборд нас не унесло.
    expect(screen.getByTestId('location')).toHaveTextContent('/reset-password');
  });

  // 8
  it('set-password не делает предварительный GET и не раскрывает пользователя', async () => {
    const requests = trackRequests(server);
    const { user } = renderApp('/set-password?token=set-valid-token');

    await screen.findByLabelText('Новый пароль');

    // До отправки формы — ни одного обращения к set-password и никакого профиля.
    expect(requests.some((entry) => entry.includes('set-password'))).toBe(false);
    expect(requests.some((entry) => entry.startsWith('GET') && entry.includes('/auth/'))).toBe(
      false,
    );
    expect(screen.queryByText(/invited@mentortaskflow\.test/i)).toBeNull();
    expect(screen.queryByText(/Ситора/i)).toBeNull();
    // Токен не отображается в UI (data-testid="location" — служебный пробник тестов).
    expect(screen.getByRole('main').innerHTML).not.toContain('set-valid-token');

    await fillPasswords(user, STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: /создать пароль/i }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Аккаунт активирован' })).toBeInTheDocument();
    });
  });

  it('подходят 5–8 любых символов, короче и длиннее — нет, и запрос не уходит', async () => {
    const requests = trackRequests(server);
    const { user } = renderApp('/reset-password?token=reset-valid-token');

    await fillPasswords(user, '1234');
    await user.click(screen.getByRole('button', { name: /сохранить пароль/i }));
    expect(await screen.findByText(/минимум 5 символов/i)).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Новый пароль'));
    await user.clear(screen.getByLabelText('Повторите пароль'));
    await fillPasswords(user, '123456789');
    await user.click(screen.getByRole('button', { name: /сохранить пароль/i }));
    expect(await screen.findByText(/не более 8 символов/i)).toBeInTheDocument();

    expect(requests.some((entry) => entry.includes('reset-password'))).toBe(false);

    // Только цифры — тоже допустимо.
    await user.clear(screen.getByLabelText('Новый пароль'));
    await user.clear(screen.getByLabelText('Повторите пароль'));
    await fillPasswords(user, '12345');
    await user.click(screen.getByRole('button', { name: /сохранить пароль/i }));
    expect(await screen.findByRole('heading', { name: 'Пароль обновлён' })).toBeInTheDocument();
  });

  it('после установки пароля по приглашению email уже подставлен на странице входа', async () => {
    const { user } = renderApp('/set-password?token=set-valid-token');

    await fillPasswords(user, STRONG_PASSWORD);
    await user.click(screen.getByRole('button', { name: /создать пароль/i }));

    await screen.findByRole('heading', { name: 'Аккаунт активирован' });
    expect(screen.getByText('invited@mentortaskflow.test')).toBeInTheDocument();

    await user.click(screen.getByRole('link', { name: /перейти ко входу/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(screen.getByLabelText('Email')).toHaveValue('invited@mentortaskflow.test');
    // Осталось ввести пароль — фокус уже там.
    expect(screen.getByLabelText('Пароль')).toHaveFocus();
  });
});
