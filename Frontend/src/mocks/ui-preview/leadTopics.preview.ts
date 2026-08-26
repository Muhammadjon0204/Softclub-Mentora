import { DAY_MS, MOCK_NOW } from '../domain/reference';

/**
 * Demo-данные Topic/TopicAssignment (ТЗ 2.2, разделы 10.4–10.5) для Lead
 * раздела `/lead/schedule` — scoped по `categoryId`, тем же трём категориям,
 * что `leadAssignments.preview.ts` (своя + два isolation-fixture).
 */

export type TopicAssignmentType = 'Presentation' | 'ClassTask' | 'HomeTask';

export interface LeadTopicAssignmentRecord {
  id: string;
  topicId: string;
  type: TopicAssignmentType;
  title: string;
  description: string;
  isRequired: boolean;
  isActive: boolean;
  /** Real `TopicAssignmentDto.concurrencyToken` — required by `update`/`activate`/`deactivate`. Optional so the fixture array below doesn't need a synthetic value. */
  concurrencyToken?: string;
}

export interface LeadTopicRecord {
  id: string;
  categoryId: string;
  dayNumber: number;
  /**
   * Real `TopicDto.plannedDate` is `DateOnly?` — genuinely optional. The old preview fixture always
   * populated it (never `null`); the real backend does not guarantee that (Phase 1E contract map, TP1
   * row). Every UI call site that reads this field must handle `null`.
   */
  plannedDate: number | null;
  title: string;
  description: string;
  isActive: boolean;
  /** Real `TopicDto.concurrencyToken` — required by `update`/`activate`/`deactivate`. Optional so the fixture array below doesn't need a synthetic value. */
  concurrencyToken?: string;
}

export const TOPIC_ASSIGNMENT_TYPE_LABEL: Record<TopicAssignmentType, string> = {
  Presentation: 'Презентация',
  ClassTask: 'Аудиторное задание',
  HomeTask: 'Домашнее задание',
};

const now = MOCK_NOW;
const D = DAY_MS;

const HQ_CS = 'cat-hq-csharp';
const HQ_FE = 'cat-hq-frontend';
const KHU_CS = 'cat-khu-csharp';

export const LEAD_TOPICS: LeadTopicRecord[] = [
  { id: 'top-hqcs-1', categoryId: HQ_CS, dayNumber: 1, plannedDate: now - 20 * D, title: 'Основы C# и .NET', description: 'Типы данных, переменные, операторы, точка входа приложения.', isActive: true },
  { id: 'top-hqcs-2', categoryId: HQ_CS, dayNumber: 2, plannedDate: now - 17 * D, title: 'ООП: классы и интерфейсы', description: 'Инкапсуляция, наследование, полиморфизм на практике.', isActive: true },
  { id: 'top-hqcs-3', categoryId: HQ_CS, dayNumber: 3, plannedDate: now - 13 * D, title: 'SOLID и рефакторинг', description: 'Пять принципов SOLID на примере учебного сервиса.', isActive: true },
  { id: 'top-hqcs-4', categoryId: HQ_CS, dayNumber: 4, plannedDate: now - 6 * D, title: 'LINQ и коллекции', description: 'Работа с IEnumerable, отложенные вычисления, LINQ to Objects.', isActive: true },
  { id: 'top-hqcs-5', categoryId: HQ_CS, dayNumber: 5, plannedDate: now - 2 * D, title: 'Асинхронность в .NET', description: 'Task, async/await, отмена операций через CancellationToken.', isActive: true },
  { id: 'top-hqcs-6', categoryId: HQ_CS, dayNumber: 6, plannedDate: now + 1 * D, title: 'Тестирование: xUnit и Moq', description: 'Юнит-тесты сервисного слоя, mock-объекты зависимостей.', isActive: true },
  { id: 'top-hqcs-7', categoryId: HQ_CS, dayNumber: 7, plannedDate: now + 4 * D, title: 'Кэширование и производительность', description: 'IMemoryCache, распределённый кэш, стратегии инвалидации.', isActive: true },
  { id: 'top-hqcs-8', categoryId: HQ_CS, dayNumber: 8, plannedDate: now + 9 * D, title: 'Развёртывание и Docker', description: 'Контейнеризация ASP.NET Core приложения — тема временно снята с расписания.', isActive: false },

  { id: 'top-hqfe-1', categoryId: HQ_FE, dayNumber: 1, plannedDate: now - 12 * D, title: 'Компонентная модель React', description: 'Props, state, композиция компонентов.', isActive: true },
  { id: 'top-hqfe-2', categoryId: HQ_FE, dayNumber: 2, plannedDate: now - 5 * D, title: 'Формы и валидация', description: 'Controlled-компоненты, обработка ошибок ввода.', isActive: true },
  { id: 'top-hqfe-3', categoryId: HQ_FE, dayNumber: 3, plannedDate: now + 3 * D, title: 'Адаптивная вёрстка', description: 'Mobile-first подход, брейкпоинты, responsive images.', isActive: true },

  { id: 'top-khucs-1', categoryId: KHU_CS, dayNumber: 1, plannedDate: now - 9 * D, title: 'Dependency Injection', description: 'Встроенный DI-контейнер .NET, время жизни сервисов.', isActive: true },
  { id: 'top-khucs-2', categoryId: KHU_CS, dayNumber: 2, plannedDate: now - 3 * D, title: 'Middleware pipeline', description: 'Порядок middleware, собственные middleware-компоненты.', isActive: true },
  { id: 'top-khucs-3', categoryId: KHU_CS, dayNumber: 3, plannedDate: now + 2 * D, title: 'Индексы PostgreSQL', description: 'B-tree индексы, планы запросов, EXPLAIN ANALYZE.', isActive: true },
];

export const LEAD_TOPIC_ASSIGNMENTS: LeadTopicAssignmentRecord[] = [
  { id: 'tpa-hqcs-oop-1', topicId: 'top-hqcs-2', type: 'Presentation', title: 'Презентация: ООП в C#', description: 'Слайды с примерами инкапсуляции/наследования/полиморфизма.', isRequired: true, isActive: true },
  { id: 'tpa-hqcs-oop-2', topicId: 'top-hqcs-2', type: 'HomeTask', title: 'Домашнее задание: иерархия классов', description: 'Спроектировать и реализовать иерархию классов «Транспорт».', isRequired: true, isActive: true },
  { id: 'tpa-hqcs-linq', topicId: 'top-hqcs-4', type: 'HomeTask', title: 'LINQ и работа с коллекциями', description: 'Набор задач на Where/Select/GroupBy/Join.', isRequired: true, isActive: true },
  { id: 'tpa-hqcs-linq-class', topicId: 'top-hqcs-4', type: 'ClassTask', title: 'Аудиторная практика: LINQ live-coding', description: 'Совместное решение задач на паре.', isRequired: false, isActive: true },
  { id: 'tpa-hqcs-async', topicId: 'top-hqcs-5', type: 'HomeTask', title: 'Асинхронное программирование: Task и async/await', description: 'Разобрать модель асинхронности .NET.', isRequired: true, isActive: true },
  { id: 'tpa-hqcs-xunit', topicId: 'top-hqcs-6', type: 'HomeTask', title: 'Юнит-тестирование с xUnit', description: 'Покрыть сервисный слой тестами.', isRequired: true, isActive: true },
  { id: 'tpa-hqcs-cache', topicId: 'top-hqcs-7', type: 'HomeTask', title: 'Кэширование с IMemoryCache и Redis', description: 'Двухуровневое кэширование справочников.', isRequired: true, isActive: true },
  { id: 'tpa-hqcs-docker', topicId: 'top-hqcs-8', type: 'HomeTask', title: 'Docker-образ для sandbox-окружения', description: 'Написать Dockerfile и docker-compose для локального запуска.', isRequired: true, isActive: false },

  { id: 'tpa-hqfe-forms', topicId: 'top-hqfe-2', type: 'HomeTask', title: 'Форма обратной связи с валидацией', description: 'Реализовать форму с client-side валидацией и отображением ошибок.', isRequired: true, isActive: true },
  { id: 'tpa-hqfe-onboarding', topicId: 'top-hqfe-3', type: 'HomeTask', title: 'Мобильный экран онбординга', description: 'Адаптивная вёрстка экрана онбординга под 375–1440px.', isRequired: true, isActive: true },

  { id: 'tpa-khucs-di', topicId: 'top-khucs-1', type: 'HomeTask', title: 'Введение в Dependency Injection', description: 'Перевести статический сервис на встроенный DI-контейнер.', isRequired: true, isActive: true },
  { id: 'tpa-khucs-mw', topicId: 'top-khucs-2', type: 'HomeTask', title: 'ASP.NET Core Middleware pipeline', description: 'Собственный middleware ограничения частоты запросов.', isRequired: true, isActive: true },
  { id: 'tpa-khucs-indexes', topicId: 'top-khucs-3', type: 'HomeTask', title: 'Индексы и планы запросов PostgreSQL', description: 'Оптимизировать три медленных запроса.', isRequired: true, isActive: true },
];

export function topicAssignmentsOfTopic(topicId: string): LeadTopicAssignmentRecord[] {
  return LEAD_TOPIC_ASSIGNMENTS.filter((item) => item.topicId === topicId);
}
