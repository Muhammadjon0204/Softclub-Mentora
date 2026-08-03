import { screen, waitFor, within } from '@testing-library/react';
import { HttpResponse, http } from 'msw';
import { afterEach, describe, expect, it } from 'vitest';

import { authApi } from '../api/auth';
import { clearAccessToken } from '../auth/tokenStore';
import { server } from '../mocks/server';
import { DEMO_PASSWORD, TEST_ACCOUNTS, renderApp } from './utils';

async function loginAs(email: string): Promise<void> {
  await authApi.login({ email, password: DEMO_PASSWORD });
  clearAccessToken();
}

describe('Admin UI: фундамент и Dashboard', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  // 1
  it('Organization Admin видит пункт «Филиалы», branch selector и режим «Все филиалы»', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Обзор организации' })).toBeInTheDocument();
    expect(screen.getByText('Филиалы')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Все филиалы/i })).toBeInTheDocument();

    // Дашборд в режиме «Все филиалы» показывает таблицу филиалов, а не категорий.
    expect(await screen.findByRole('heading', { name: 'Состояние филиалов' })).toBeInTheDocument();
    expect(screen.getAllByText('Главный офис').length).toBeGreaterThan(0);
    expect(screen.getByText('Филиал Худжанд')).toBeInTheDocument();
    expect(screen.getByText('Филиал Бохтар')).toBeInTheDocument();
    // Филиал Бохтар намеренно без Branch Admin (ТЗ TEN-017) — заметно на дашборде.
    expect(screen.getByText('без Admin')).toBeInTheDocument();
  });

  // 2
  it('Branch Admin не видит пункт «Филиалы»; вместо selector — фиксированный badge', async () => {
    await loginAs(TEST_ACCOUNTS.branchAdminHead);
    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Обзор филиала' })).toBeInTheDocument();
    expect(screen.queryByText('Филиалы')).toBeNull();

    // Badge виден (несколько вхождений имени филиала допустимы — sidebar + topbar).
    expect(screen.getAllByText('Главный офис').length).toBeGreaterThan(0);
    // У Branch Admin нет интерактивного селектора филиала.
    expect(document.querySelector('[aria-haspopup="listbox"]')).toBeNull();

    // Показатели относятся к категориям, а не к сводке по филиалам.
    expect(await screen.findByRole('heading', { name: 'Состояние категорий' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Состояние филиалов' })).toBeNull();
  });

  // 3 + 6 + 7
  it('Organization Admin переключает филиал — данные меняются, старые не показываются', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Обзор организации' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Все филиалы/i }));
    await user.type(screen.getByPlaceholderText('Поиск по филиалам…'), 'Худжанд');
    await user.click(await screen.findByRole('option', { name: /Худжанд/i }));

    // Заголовок сменился на филиальный, таблица филиалов исчезла — новых
    // «Все филиалы» данных быть не может одновременно со сводкой по категориям.
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Обзор филиала' })).toBeInTheDocument();
    });
    expect(screen.queryByRole('heading', { name: 'Состояние филиалов' })).toBeNull();
    expect(await screen.findByRole('heading', { name: 'Состояние категорий' })).toBeInTheDocument();

    // Категория Design существует только в Худжанде и её вести некому (ТЗ SCH-018) —
    // характерный, проверяемый признак того, что подгрузились именно его данные.
    expect(await screen.findByText('Design')).toBeInTheDocument();
    expect(screen.getByText('нет лида')).toBeInTheDocument();
  });

  // 8
  it('Branch Admin филиала Худжанд не получает данные другого филиала', async () => {
    await loginAs(TEST_ACCOUNTS.branchAdminKhujand);
    renderApp('/admin/dashboard');

    expect(await screen.findByRole('heading', { name: 'Обзор филиала' })).toBeInTheDocument();
    expect(screen.getAllByText('Филиал Худжанд').length).toBeGreaterThan(0);

    // Категория Design существует только в Худжанде — присутствует.
    expect(await screen.findByText('Design')).toBeInTheDocument();
    // Категория «Frontend» существует только в Главном офисе и Бохтаре —
    // на дашборде филиала Худжанд её не должно быть вовсе (только один филиал в scope).
    expect(screen.queryByText('Frontend')).toBeNull();
  });

  // 19
  it('Ошибка загрузки дашборда показывает ErrorState с кнопкой повтора', async () => {
    server.use(
      http.get('*/api/v1/admin/dashboard', () =>
        HttpResponse.json(
          { type: 'about:blank', title: 'err', status: 500, code: 'INTERNAL_ERROR', detail: '', instance: '', traceId: 't', errors: {} },
          { status: 500 },
        ),
      ),
    );

    await loginAs(TEST_ACCOUNTS.admin);
    renderApp('/admin/dashboard');

    expect(await screen.findByText('Не удалось загрузить обзор')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /повторить/i })).toBeInTheDocument();
  });
});

describe('Admin shell: sidebar collapse и profile dropdown', () => {
  afterEach(() => {
    server.resetHandlers();
  });

  it('нижняя organization/status-карточка удалена из sidebar', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    expect(screen.queryByText(/система работает/i)).toBeNull();
  });

  it('старой нижней collapse-кнопки («…боковую панель») больше нет', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    expect(screen.queryByRole('button', { name: /боковую панель/i })).toBeNull();
  });

  it('floating collapse button отображается на desktop и переключает состояние sidebar', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    const collapseButton = screen.getByRole('button', { name: 'Свернуть меню' });
    expect(collapseButton).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Уведомления')).toBeInTheDocument();

    await user.click(collapseButton);

    const expandButton = await screen.findByRole('button', { name: 'Развернуть меню' });
    expect(expandButton).toHaveAttribute('aria-expanded', 'false');
    // Подписи пунктов навигации в collapsed-состоянии не просто скрыты CSS —
    // они не рендерятся вовсе.
    expect(screen.queryByText('Уведомления')).toBeNull();

    await user.click(expandButton);

    expect(await screen.findByRole('button', { name: 'Свернуть меню' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Уведомления')).toBeInTheDocument();
  });

  it('floating collapse button не дублируется в mobile drawer', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    // Desktop-вариант AdminSidebar смонтирован всегда — ровно одна кнопка.
    expect(screen.getAllByRole('button', { name: 'Свернуть меню' })).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Открыть меню' }));

    // Mobile-вариант (variant="mobile") floating-кнопку не рендерит вовсе —
    // второй кнопки в drawer быть не должно.
    expect(screen.getAllByRole('button', { name: 'Свернуть меню' })).toHaveLength(1);
  });

  it('«Настройки» удалён из основной навигации sidebar', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    expect(screen.queryByText('Настройки')).toBeNull();
  });

  it('отдельная кнопка «Выйти» удалена из topbar', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    expect(screen.queryByRole('button', { name: /^выйти$/i })).toBeNull();
  });

  it('profile dropdown открывается по клику на trigger и показывает имя/email/scope/organization', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    const trigger = screen.getByRole('button', { name: 'Открыть меню профиля' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    await user.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    // Топбар (branch selector) уже показывает «Все филиалы» своим триггером —
    // сравнение ведём внутри самой панели dropdown, а не по всему документу.
    const panel = within(screen.getByTestId('profile-menu-panel'));
    expect(panel.getByText('Шахло Мирзоева')).toBeInTheDocument();
    expect(panel.getByText('organization-admin@mentortaskflow.test')).toBeInTheDocument();
    // Один компактный scope-badge вместо двух отдельных «Администратор» + «Организация».
    expect(panel.getByText('Администратор организации')).toBeInTheDocument();
    expect(panel.getByText('SoftClub IT Academy')).toBeInTheDocument();
    // Ни один филиал не выбран — Organization Admin по умолчанию в режиме «Все филиалы».
    expect(panel.getByText('Все филиалы')).toBeInTheDocument();
    // Никаких технических ID в контексте организации.
    expect(panel.queryByText(/org-|branch-/i)).toBeNull();
  });

  it('Organization Admin видит «Настройки» в dropdown', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    await user.click(screen.getByRole('button', { name: 'Открыть меню профиля' }));

    expect(screen.getByRole('menuitem', { name: /настройки/i })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: /профиль/i })).toBeInTheDocument();
  });

  it('«Выйти» в dropdown вызывает существующий logout() и уводит на /login', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    await user.click(screen.getByRole('button', { name: 'Открыть меню профиля' }));
    await user.click(screen.getByRole('menuitem', { name: /выйти/i }));

    await waitFor(() => {
      expect(screen.getByTestId('location')).toHaveTextContent('/login');
    });
  });

  it('Escape закрывает dropdown и возвращает фокус на trigger', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    const trigger = screen.getByRole('button', { name: 'Открыть меню профиля' });
    await user.click(trigger);
    expect(screen.getByRole('menuitem', { name: /выйти/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menuitem', { name: /выйти/i })).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('клик вне dropdown закрывает его', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    const heading = await screen.findByRole('heading', { name: 'Обзор организации' });

    await user.click(screen.getByRole('button', { name: 'Открыть меню профиля' }));
    expect(screen.getByRole('menuitem', { name: /выйти/i })).toBeInTheDocument();

    await user.click(heading);

    expect(screen.queryByRole('menuitem', { name: /выйти/i })).toBeNull();
  });

  it('на mobile trigger профиля остаётся доступен через стабильный aria-label (виден только avatar)', async () => {
    await loginAs(TEST_ACCOUNTS.organizationAdmin);
    const { user } = renderApp('/admin/dashboard');
    await screen.findByRole('heading', { name: 'Обзор организации' });

    // Имя/роль скрыты на mobile через CSS (`hidden sm:flex`), которое jsdom не
    // вычисляет, — здесь проверяется то, что реально гарантирует доступность
    // на узком экране: стабильный aria-label, не зависящий от видимого текста.
    const trigger = screen.getByRole('button', { name: 'Открыть меню профиля' });
    await user.click(trigger);

    expect(screen.getByRole('menuitem', { name: /профиль/i })).toBeInTheDocument();
  });
});
