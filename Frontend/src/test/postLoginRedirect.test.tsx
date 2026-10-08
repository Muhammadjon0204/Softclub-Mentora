import { screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { postLoginPath } from '../auth/roleRedirect';
import { DEMO_PASSWORD, TEST_ACCOUNTS, renderApp } from './utils';

describe('Возврат на исходную страницу после входа', () => {
  it('ссылка на задание (например из Telegram) переживает вход', async () => {
    const { user } = renderApp('/admin/users?userId=abc');

    // Не вошли — RequireAuth отправил на /login, запомнив, куда шли.
    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });

    await user.type(screen.getByLabelText('Email'), TEST_ACCOUNTS.admin);
    await user.type(screen.getByLabelText('Пароль'), DEMO_PASSWORD);
    await user.click(screen.getByRole('button', { name: /войти/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/admin/users?userId=abc');
    });
  });

  it('только внутрь своего раздела и только относительный путь', () => {
    expect(postLoginPath('Lead', '/lead/review-queue?assignmentId=1')).toBe('/lead/review-queue?assignmentId=1');
    expect(postLoginPath('Mentor', '/mentor/tasks?assignmentId=1')).toBe('/mentor/tasks?assignmentId=1');

    // Чужой раздел, внешний адрес, мусор — дашборд своей роли.
    expect(postLoginPath('Mentor', '/admin/users')).toBe('/mentor/dashboard');
    expect(postLoginPath('Lead', 'https://evil.example/lead/x')).toBe('/lead/dashboard');
    expect(postLoginPath('Lead', '//evil.example/lead/')).toBe('/lead/dashboard');
    expect(postLoginPath('Lead', '/lead/\\evil.example')).toBe('/lead/dashboard');
    expect(postLoginPath('Admin', undefined)).toBe('/admin/dashboard');
  });
});
