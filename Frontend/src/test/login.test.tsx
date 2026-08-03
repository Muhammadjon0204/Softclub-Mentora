import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { db } from '../mocks/db';
import { DEMO_PASSWORD, TEST_ACCOUNTS, renderApp } from './utils';

async function submitLogin(
  user: ReturnType<typeof renderApp>['user'],
  email: string,
  password: string,
): Promise<void> {
  const emailField = await screen.findByLabelText('Email');
  const passwordField = screen.getByLabelText('Пароль');

  await user.clear(emailField);
  await user.type(emailField, email);
  await user.clear(passwordField);
  await user.type(passwordField, password);
  await user.click(screen.getByRole('button', { name: /войти/i }));
}

describe('LoginPage', () => {
  // 1
  it('Admin после входа попадает на /admin/dashboard', async () => {
    const { user } = renderApp('/login');
    await submitLogin(user, TEST_ACCOUNTS.admin, DEMO_PASSWORD);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/dashboard');
    });
  });

  // 2
  it('Lead после входа попадает на /lead/dashboard', async () => {
    const { user } = renderApp('/login');
    await submitLogin(user, TEST_ACCOUNTS.lead, DEMO_PASSWORD);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/lead/dashboard');
    });
  });

  // 3
  it('Mentor после входа попадает на /mentor/dashboard', async () => {
    const { user } = renderApp('/login');
    await submitLogin(user, TEST_ACCOUNTS.mentor, DEMO_PASSWORD);

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/mentor/dashboard');
    });
  });

  // 4
  it('неверный пароль, lockout и PasswordHash=null дают один и тот же текст', async () => {
    const { user } = renderApp('/login');

    await submitLogin(user, TEST_ACCOUNTS.mentor, 'WrongPassword123');
    const wrongPasswordText = (await screen.findByRole('alert')).textContent;

    await submitLogin(user, TEST_ACCOUNTS.locked, DEMO_PASSWORD);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Неверный email или пароль');
    });
    const lockedText = screen.getByRole('alert').textContent;

    await submitLogin(user, TEST_ACCOUNTS.invited, DEMO_PASSWORD);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Неверный email или пароль');
    });
    const noPasswordText = screen.getByRole('alert').textContent;

    expect(wrongPasswordText).toContain('Неверный email или пароль');
    expect(lockedText).toBe(wrongPasswordText);
    expect(noPasswordText).toBe(wrongPasswordText);
  });

  it('пять неудачных попыток включают lockout учётной записи', async () => {
    const { user } = renderApp('/login');

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await submitLogin(user, TEST_ACCOUNTS.reuse, 'WrongPassword123');
      await screen.findByRole('alert');
    }

    const account = db.users.find((item) => item.email === TEST_ACCOUNTS.reuse);
    expect(account?.lockoutUntil).not.toBeNull();

    // Верный пароль во время lockout возвращает ровно тот же ответ.
    await submitLogin(user, TEST_ACCOUNTS.reuse, DEMO_PASSWORD);
    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Неверный email или пароль');
    });
  });

  // 5
  it('429 показывает countdown по Retry-After и блокирует кнопку', async () => {
    // Забиваем bucket маршрута, чтобы не гонять 10 реальных запросов.
    db.rateLimitBuckets['login'] = { windowStartedAt: Date.now(), count: 10 };

    const { user } = renderApp('/login');
    await submitLogin(user, TEST_ACCOUNTS.admin, DEMO_PASSWORD);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent(/Слишком много попыток\. Повторите через \d+/);

    const button = screen.getByRole('button', { name: /повторить через/i });
    expect(button).toBeDisabled();
  });
});
