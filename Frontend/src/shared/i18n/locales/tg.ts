import type { TranslationTree } from './ru';

/**
 * Тоҷикӣ (кириллица). Терминология интерфейсная, не художественная — там, где устоявшегося
 * короткого тоҷикӣ-эквивалента нет (CRM и т. п.), термин оставлен как есть, это обычная практика
 * в местных IT-продуктах. Стоит сверить с носителем языка перед тем, как полагаться на формулировки
 * в проде — переведено по значению, не проверено живым носителем.
 */
export const tg: TranslationTree = {
  nav: {
    admin: {
      dashboard: 'Дурнамо',
      branches: 'Филиалҳо',
      users: 'Корбарон',
      categories: 'Категорияҳо',
      assignments: 'Супоришҳо',
      calendar: 'Тақвим',
      reports: 'Ҳисоботҳо',
      audit: 'Сабти аудит',
      notifications: 'Огоҳиномаҳо',
      health: 'Ҳолати система',
      crm: 'Интегратсияи CRM',
    },
    lead: {
      dashboard: 'Дурнамо',
      assignments: 'Супоришҳо',
      'review-queue': 'Дар тафтиш',
      calendar: 'Тақвим',
      team: 'Даста',
      reports: 'Ҳисоботҳо',
      crm: 'Гурӯҳҳо дар CRM',
    },
    mentor: {
      dashboard: 'Дурнамо',
      tasks: 'Супоришҳои ман',
      calendar: 'Тақвим',
      history: 'Таърих',
      reports: 'Ҳисоботҳо',
      notifications: 'Огоҳиномаҳо',
      crm: 'Гурӯҳҳо дар CRM',
    },
    soon: 'Ба зудӣ',
    expandMenu: 'Васеъ кардани меню',
    collapseMenu: 'Пӯшидани меню',
    ariaLabel: 'Навигатсияи асосӣ',
    brandHome: 'RAVAND — ба дурнамо гузаштан',
  },
  breadcrumbs: {
    ariaLabel: 'Пайроҳаи навигатсия',
    admin: 'Панели маъмур',
    lead: 'Панели роҳбар',
    mentor: 'Панели ментор',
  },
  topbar: {
    openMenu: 'Кушодани меню',
    help: 'Кумак',
    offline: 'Пайваст нест',
  },
  theme: {
    switchToDark: 'Гузариш ба мавзӯи торик',
    switchToLight: 'Гузариш ба мавзӯи равшан',
  },
  lang: {
    switcherLabel: 'Забони интерфейс',
    ru: 'Русский',
    tg: 'Тоҷикӣ',
    en: 'English',
  },
  profile: {
    openMenu: 'Кушодани менюи профил',
    role: {
      admin: 'Маъмур',
      lead: 'Роҳбари самт',
      mentor: 'Ментор',
      orgAdmin: 'Маъмури ташкилот',
      branchAdmin: 'Маъмури филиал',
    },
    allBranches: 'Ҳамаи филиалҳо',
    branchSelected: 'Филиал интихоб шуд',
    profile: 'Профил',
    settings: 'Танзимот',
    logout: 'Баромадан',
    actionsLabel: 'Амалҳои профил',
  },
  auth: {
    login: {
      title: 'Воридшавӣ ба RAVAND',
      subtitle: 'Барои идома додан почта ва рамзи худро ворид кунед.',
      email: 'Email',
      password: 'Рамз',
      forgotPassword: 'Рамзро фаромӯш кардед?',
      submit: 'Воридшавӣ',
    },
  },
};
