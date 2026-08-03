/** Демо-данные страницы /admin/assignments (UI-прототип, раздел 9 сессии). Admin здесь только наблюдает. */

export type PreviewAssignmentStatus = 'Assigned' | 'Submitted' | 'InReview' | 'NeedsRework' | 'Overdue' | 'Approved';

export const ASSIGNMENT_STATUS_LABEL: Record<PreviewAssignmentStatus, string> = {
  Assigned: 'Назначено',
  Submitted: 'Отправлено',
  InReview: 'На проверке',
  NeedsRework: 'Требует доработки',
  Overdue: 'Просрочено',
  Approved: 'Одобрено',
};

export interface PreviewAssignment {
  id: string;
  title: string;
  mentorName: string;
  branchName: string;
  categoryName: string;
  status: PreviewAssignmentStatus;
  dueLabel: string;
  source: 'Индивидуальное' | 'Из шаблона направления';
  lastActivityLabel: string;
}

const TITLES = [
  'REST API для каталога курсов', 'Компонент авторизации на React', 'Оптимизация SQL-запросов',
  'Верстка карточки профиля', 'CI/CD pipeline для сервиса отчётов', 'Юнит-тесты для модуля оплаты',
  'Дизайн-система: кнопки и формы', 'Мобильный экран онбординга', 'Интеграция с Telegram Bot API',
  'Рефакторинг сервиса уведомлений', 'Дашборд аналитики для Lead', 'Миграция базы данных на PostgreSQL 16',
  'Автотесты для формы регистрации', 'Прототип мобильного приложения', 'Настройка мониторинга Grafana',
  'Landing page для программы стажировки', 'Оптимизация загрузки изображений', 'Docker-образ для sandbox-окружения',
  'Обработка ошибок в API Gateway', 'Экран статистики ментора', 'Скрипт импорта пользователей',
  'Redux-стор для модуля заданий', 'Аудит доступности форм', 'GraphQL-схема для отчётов',
  'Модуль экспорта в Excel', 'Kubernetes helm-chart для сервиса', 'Тестовое покрытие auth-модуля',
  'Форма обратной связи от менторов', 'Пагинация в таблице пользователей', 'Кэширование ответов API',
  'Уведомления в реальном времени', 'Скрипт резервного копирования', 'Валидация форм на клиенте',
  'Компонент выбора даты', 'Логирование действий администратора',
];

const MENTORS = [
  'Рустам Раҳимов', 'Шервон Назаров', 'Джамшед Юлдашев', 'Хуршед Абдуллоев', 'Бахтиёр Турсунов',
  'Гулнора Саидова', 'Зарина Умарова', 'Фарзона Латипова', 'Мунира Қосимова', 'Дилноза Одинаева',
];
const BRANCHES = ['Главный офис', 'Филиал Худжанд', 'Филиал Бохтар'];
const CATEGORIES = ['C#', 'Frontend', 'Python', 'UI/UX Design', 'Mobile Development', 'QA', 'DevOps', 'Data Science'];
const STATUS_CYCLE: PreviewAssignmentStatus[] = [
  'Assigned', 'Submitted', 'InReview', 'Approved', 'Assigned', 'Submitted',
  'NeedsRework', 'Approved', 'InReview', 'Overdue', 'Assigned', 'Approved',
];

function buildAssignments(count: number): PreviewAssignment[] {
  const rows: PreviewAssignment[] = [];
  for (let index = 0; index < count; index += 1) {
    const status = STATUS_CYCLE[index % STATUS_CYCLE.length];
    const daysOffset = (index % 12) - 4;
    rows.push({
      id: `asn-${index + 1}`,
      title: TITLES[index % TITLES.length],
      mentorName: MENTORS[index % MENTORS.length],
      branchName: BRANCHES[index % BRANCHES.length],
      categoryName: CATEGORIES[(index * 2 + 1) % CATEGORIES.length],
      status,
      dueLabel:
        status === 'Overdue'
          ? `Просрочено на ${1 + (index % 4)} дн.`
          : daysOffset <= 0
            ? `Сегодня + ${Math.abs(daysOffset) + 1} дн.`
            : `Через ${daysOffset} дн.`,
      source: index % 4 === 0 ? 'Индивидуальное' : 'Из шаблона направления',
      lastActivityLabel: index % 3 === 0 ? 'Сегодня' : index % 3 === 1 ? 'Вчера' : `${2 + (index % 5)} дн. назад`,
    });
  }
  return rows;
}

export const PREVIEW_ASSIGNMENTS: PreviewAssignment[] = buildAssignments(35);

/** Значения зафиксированы явно (не выведены из таблицы ниже) — таблица показывает лишь выборку строк. */
export const PREVIEW_ASSIGNMENT_SUMMARY = {
  active: 35,
  pendingReview: 16,
  overdue: 4,
  approvedThisPeriod: 28,
};

export const PREVIEW_ASSIGNMENT_STATUS_DISTRIBUTION: { status: PreviewAssignmentStatus; count: number }[] = [
  { status: 'Assigned', count: 12 },
  { status: 'Submitted', count: 9 },
  { status: 'InReview', count: 7 },
  { status: 'NeedsRework', count: 3 },
  { status: 'Overdue', count: 4 },
  { status: 'Approved', count: 28 },
];
