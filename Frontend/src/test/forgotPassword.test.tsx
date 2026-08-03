import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TEST_ACCOUNTS, renderApp } from './utils';

async function submitEmail(
  user: ReturnType<typeof renderApp>['user'],
  email: string,
): Promise<string> {
  const field = await screen.findByLabelText('Email');
  await user.clear(field);
  await user.type(field, email);
  await user.click(screen.getByRole('button', { name: /отправить ссылку/i }));

  const success = await screen.findByText(/Если такой email зарегистрирован/i);
  return success.textContent ?? '';
}

describe('ForgotPasswordPage', () => {
  // 6
  it('показывает один и тот же экран для существующего и неизвестного email', async () => {
    const known = renderApp('/forgot-password');
    const knownText = await submitEmail(known.user, TEST_ACCOUNTS.admin);
    known.unmount();

    const unknown = renderApp('/forgot-password');
    const unknownText = await submitEmail(unknown.user, 'no-such-user@nowhere.test');

    expect(knownText).toContain('Если такой email зарегистрирован');
    expect(unknownText).toBe(knownText);
  });

  it('не раскрывает существование аккаунта и не предлагает регистрацию', async () => {
    const { user } = renderApp('/forgot-password');
    await submitEmail(user, 'no-such-user@nowhere.test');

    expect(screen.queryByText(/не найден|не зарегистрирован|зарегистрируйтесь/i)).toBeNull();
  });
});
