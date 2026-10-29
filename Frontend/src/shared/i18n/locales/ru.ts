/**
 * Русский — базовый язык (и fallback для ключей, которых ещё нет в `en.ts`/`tg.ts`, см.
 * `translations.ts: resolve()`). Форма дерева задаёт форму для остальных локалей —
 * `en.ts`/`tg.ts` обязаны повторять точно те же пути.
 */
export const ru = {
  nav: {
    admin: {
      dashboard: 'Обзор',
      branches: 'Филиалы',
      users: 'Пользователи',
      categories: 'Категории',
      assignments: 'Задания',
      calendar: 'Календарь',
      reports: 'Отчёты',
      audit: 'Журнал аудита',
      notifications: 'Уведомления',
      health: 'Состояние системы',
      crm: 'Интеграция CRM',
    },
    lead: {
      dashboard: 'Обзор',
      assignments: 'Задания',
      'review-queue': 'На проверке',
      calendar: 'Календарь',
      team: 'Команда',
      reports: 'Отчёты',
      crm: 'Группы в CRM',
    },
    mentor: {
      dashboard: 'Обзор',
      tasks: 'Мои задания',
      calendar: 'Календарь',
      history: 'История',
      reports: 'Отчёты',
      notifications: 'Уведомления',
      crm: 'Группы в CRM',
    },
    soon: 'Скоро',
    expandMenu: 'Развернуть меню',
    collapseMenu: 'Свернуть меню',
    ariaLabel: 'Основная навигация',
    brandHome: 'RAVAND — перейти к обзору',
  },
  breadcrumbs: {
    ariaLabel: 'Хлебные крошки',
    admin: 'Админ-панель',
    lead: 'Панель руководителя',
    mentor: 'Панель ментора',
  },
  topbar: {
    openMenu: 'Открыть меню',
    help: 'Справка',
    offline: 'Нет соединения',
  },
  theme: {
    switchToDark: 'Включить тёмную тему',
    switchToLight: 'Включить светлую тему',
  },
  lang: {
    switcherLabel: 'Язык интерфейса',
    ru: 'Русский',
    tg: 'Тоҷикӣ',
    en: 'English',
  },
  profile: {
    openMenu: 'Открыть меню профиля',
    role: {
      admin: 'Администратор',
      lead: 'Руководитель направления',
      mentor: 'Ментор',
      orgAdmin: 'Администратор организации',
      branchAdmin: 'Администратор филиала',
    },
    allBranches: 'Все филиалы',
    branchSelected: 'Филиал выбран',
    profile: 'Профиль',
    settings: 'Настройки',
    logout: 'Выйти',
    actionsLabel: 'Действия профиля',
  },
  auth: {
    login: {
      title: 'Вход в RAVAND',
      subtitle: 'Введите рабочий email и пароль, чтобы продолжить.',
      email: 'Email',
      password: 'Пароль',
      forgotPassword: 'Забыли пароль?',
      submit: 'Войти',
    },
  },
};

export type TranslationTree = typeof ru;
