import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { authApi } from '../api/auth';
import { clearAccessToken } from '../auth/tokenStore';
import { DEMO_PASSWORD, TEST_ACCOUNTS, renderApp } from './utils';

function setOnline(value: boolean): void {
  Object.defineProperty(navigator, 'onLine', { configurable: true, value });
  window.dispatchEvent(new Event(value ? 'online' : 'offline'));
}

afterEach(() => {
  setOnline(true);
});

describe('Маршрутизация и guard-ы', () => {
  // 17
  it('оффлайн блокирует submit и показывает баннер', async () => {
    setOnline(false);
    renderApp('/login');

    await screen.findByLabelText('Email');

    expect(screen.getByRole('button', { name: /войти/i })).toBeDisabled();
    expect(screen.getAllByText(/Нет соединения/i).length).toBeGreaterThan(0);
  });

  it('после восстановления сети submit снова доступен', async () => {
    setOnline(false);
    renderApp('/login');
    await screen.findByLabelText('Email');
    expect(screen.getByRole('button', { name: /войти/i })).toBeDisabled();

    setOnline(true);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /войти/i })).toBeEnabled();
    });
  });

  // 18
  it('публичные auth-страницы доступны без аутентификации', async () => {
    const forgot = renderApp('/forgot-password');
    expect(await screen.findByRole('heading', { name: 'Восстановление пароля' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/forgot-password');
    forgot.unmount();

    const reset = renderApp('/reset-password?token=reset-valid-token');
    expect(await screen.findByLabelText('Новый пароль')).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/reset-password');
    reset.unmount();

    renderApp('/set-password?token=set-valid-token');
    expect(await screen.findByRole('heading', { name: 'Создание пароля' })).toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/set-password');
  });

  it('публичной регистрации нет: /register уводит на /login', async () => {
    renderApp('/register');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
    expect(screen.queryByText(/регистрац/i)).toBeNull();
  });

  // 19
  it('защищённый маршрут без сессии перенаправляет на /login', async () => {
    renderApp('/lead/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
  });

  // 20
  it('Mentor не может открыть маршрут Admin и уходит на свой дашборд', async () => {
    await authApi.login({ email: TEST_ACCOUNTS.mentor, password: DEMO_PASSWORD });
    clearAccessToken();

    renderApp('/admin/dashboard');

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/mentor/dashboard');
    });
    expect(screen.getByRole('heading', { name: 'Дашборд ментора' })).toBeInTheDocument();
  });
});
