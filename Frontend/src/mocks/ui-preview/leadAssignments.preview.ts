import type { TaskEventKind } from '../../features/admin-assignments/assignmentPresentation';
import { DAY_MS, HOUR_MS, MOCK_NOW } from '../domain/reference';

/**
 * Demo-данные Assignment для Lead-раздела (Phase 3, preview-only) — scoped по
 * `categoryId`, в отличие от `assignments.preview.ts` Admin-раздела, который
 * хранит только отображаемые имена филиала/категории. Здесь `categoryId`
 * обязан совпадать с id из `features/lead/scope/leadWorkspace.ts`, чтобы
 * `leadScopedData.ts` мог фильтровать строго по идентификатору, а не по имени
 * (ТЗ 2.2, TEN-071 — «C#» главного офиса и «C#» Худжанда физически разные
 * категории и не должны объединяться ни в одном представлении).
 *
 * Полный конечный автомат (ТЗ раздел 13) представлен хотя бы одним заданием
 * своей категории (`cat-hq-csharp`) на каждый статус. Категории
 * `cat-hq-frontend` (тот же Branch) и `cat-khu-csharp` (та же Category name,
 * другой Branch) — контрольные fixtures изоляции: их задания не должны
 * появляться ни в одном Lead-представлении при входе как lead-head.
 */

export type LeadAssignmentStatus =
  | 'Draft'
  | 'Suggested'
  | 'Assigned'
  | 'Submitted'
  | 'InReview'
  | 'NeedsRework'
  | 'Overdue'
  | 'Approved'
  | 'Cancelled';

export type LeadAssignmentSource = 'Auto' | 'Manual';

export interface LeadSubmissionFile {
  id: string;
  name: string;
  extension: 'pdf' | 'pptx';
  sizeLabel: string;
}

export interface LeadReviewRecord {
  id: string;
  decision: 'Approved' | 'NeedsRework';
  comment: string | null;
  reworkDueAt: number | null;
  createdAt: number;
  reviewerName: string;
}

export interface LeadSubmissionRecord {
  id: string;
  versionNumber: number;
  submittedAt: number;
  isLate: boolean;
  comment: string | null;
  files: LeadSubmissionFile[];
  review: LeadReviewRecord | null;
}

export interface LeadTaskEventRecord {
  id: string;
  kind: TaskEventKind | 'SuggestionAccepted' | 'Reassigned' | 'SuggestedCreated';
  occurredAt: number;
  actorName: string;
  detail?: string;
}

export interface LeadAssignmentRecord {
  id: string;
  categoryId: string;
  title: string;
  description: string;
  status: LeadAssignmentStatus;
  source: LeadAssignmentSource;
  mentorId: string;
  assignedById: string | null;
  topicAssignmentId: string | null;
  initialDueAt: number;
  currentDueAt: number;
  assignedAt: number | null;
  firstSubmittedAt: number | null;
  reviewStartedAt: number | null;
  approvedAt: number | null;
  overdueAt: number | null;
  cancelledAt: number | null;
  cancelReason: string | null;
  allowLateSubmission: boolean;
  submissions: LeadSubmissionRecord[];
  events: LeadTaskEventRecord[];
}

/** Lead каждой из трёх demo-категорий — используется как имя ревьюера/актора событий. */
export const CATEGORY_LEAD_NAME: Record<string, string> = {
  'cat-hq-csharp': 'Шерали Комилов',
  'cat-hq-frontend': 'Фаррух Хакимов',
  'cat-khu-csharp': 'Тимур Расулов',
};

function file(id: string, name: string, extension: 'pdf' | 'pptx', sizeLabel: string): LeadSubmissionFile {
  return { id, name, extension, sizeLabel };
}

const now = MOCK_NOW;
const H = HOUR_MS;
const D = DAY_MS;

/* ------------------------------- cat-hq-csharp (своя категория Lead) ------------------------------- */

const HQ_CS = 'cat-hq-csharp';
const leadHqCs = CATEGORY_LEAD_NAME[HQ_CS];

const hqCsharpAssignments: LeadAssignmentRecord[] = [
  {
    id: 'asn-hqcs-01',
    categoryId: HQ_CS,
    title: 'Паттерны проектирования: Repository и Unit of Work',
    description: 'Реализовать Repository и Unit of Work поверх EF Core на примере каталога курсов.',
    status: 'Draft',
    source: 'Manual',
    mentorId: 'usr-1017',
    assignedById: null,
    topicAssignmentId: null,
    initialDueAt: now + 5 * D,
    currentDueAt: now + 5 * D,
    assignedAt: null,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: 'ev-hqcs-01-1', kind: 'DraftCreated', occurredAt: now - 2 * H, actorName: leadHqCs }],
  },
  {
    id: 'asn-hqcs-02',
    categoryId: HQ_CS,
    title: 'Асинхронное программирование: Task и async/await',
    description: 'Разобрать модель асинхронности .NET, переписать блокирующий код на async/await.',
    status: 'Suggested',
    source: 'Auto',
    mentorId: 'usr-ros-cat-hq-csharp-1',
    assignedById: null,
    topicAssignmentId: 'tpa-hqcs-async',
    initialDueAt: now + 3 * D,
    currentDueAt: now + 3 * D,
    assignedAt: null,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: 'ev-hqcs-02-1', kind: 'SuggestedCreated', occurredAt: now - 6 * H, actorName: 'Система' }],
  },
  {
    id: 'asn-hqcs-03',
    categoryId: HQ_CS,
    title: 'Юнит-тестирование с xUnit',
    description: 'Покрыть сервисный слой юнит-тестами на xUnit и Moq.',
    status: 'Suggested',
    source: 'Auto',
    mentorId: 'usr-ros-cat-hq-csharp-2',
    assignedById: null,
    topicAssignmentId: 'tpa-hqcs-xunit',
    initialDueAt: now + 3 * D,
    currentDueAt: now + 3 * D,
    assignedAt: null,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: 'ev-hqcs-03-1', kind: 'SuggestedCreated', occurredAt: now - 6 * H, actorName: 'Система' }],
  },
  {
    id: 'asn-hqcs-04',
    categoryId: HQ_CS,
    title: 'REST API: контроллеры и DTO',
    description: 'Спроектировать REST-контроллеры и DTO для модуля заданий.',
    status: 'Assigned',
    source: 'Manual',
    mentorId: 'usr-1017',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now + 3 * D,
    currentDueAt: now + 3 * D,
    assignedAt: now - 2 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [
      { id: 'ev-hqcs-04-1', kind: 'DraftCreated', occurredAt: now - 2 * D - H, actorName: leadHqCs },
      { id: 'ev-hqcs-04-2', kind: 'Assigned', occurredAt: now - 2 * D, actorName: leadHqCs, detail: 'Умед Раджабов' },
    ],
  },
  {
    id: 'asn-hqcs-05',
    categoryId: HQ_CS,
    title: 'LINQ и работа с коллекциями',
    description: 'Решить набор задач на LINQ (Where/Select/GroupBy/Join) на реальном датасете.',
    status: 'Assigned',
    source: 'Auto',
    mentorId: 'usr-ros-cat-hq-csharp-3',
    assignedById: leadHqCs,
    topicAssignmentId: 'tpa-hqcs-linq',
    initialDueAt: now + 6 * H,
    currentDueAt: now + 6 * H,
    assignedAt: now - 3 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: 'ev-hqcs-05-1', kind: 'Assigned', occurredAt: now - 3 * D, actorName: leadHqCs, detail: 'Хуршед Латипов' }],
  },
  {
    id: 'asn-hqcs-06',
    categoryId: HQ_CS,
    title: 'Работа с Entity Framework Core',
    description: 'Настроить миграции и связи «многие-ко-многим» в EF Core.',
    status: 'Submitted',
    source: 'Manual',
    mentorId: 'usr-1017',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now - 10 * H,
    currentDueAt: now - 10 * H,
    assignedAt: now - 5 * D,
    firstSubmittedAt: now - 30 * H,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-06-1',
        versionNumber: 1,
        submittedAt: now - 30 * H,
        isLate: false,
        comment: 'Миграции и seed-данные приложил отдельным скриптом.',
        files: [file('f-hqcs-06-1', 'efcore-migrations.pdf', 'pdf', '2.4 МБ')],
        review: null,
      },
    ],
    events: [
      { id: 'ev-hqcs-06-1', kind: 'Assigned', occurredAt: now - 5 * D, actorName: leadHqCs, detail: 'Умед Раджабов' },
      { id: 'ev-hqcs-06-2', kind: 'SubmissionUploaded', occurredAt: now - 30 * H, actorName: 'Умед Раджабов', detail: 'Версия 1' },
    ],
  },
  {
    id: 'asn-hqcs-07',
    categoryId: HQ_CS,
    title: 'Многопоточность: Task Parallel Library',
    description: 'Реализовать параллельную обработку пакета файлов через TPL с ограничением степени параллелизма.',
    status: 'Submitted',
    source: 'Manual',
    mentorId: 'usr-ros-cat-hq-csharp-1',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now + 1 * D,
    currentDueAt: now + 1 * D,
    assignedAt: now - 4 * D,
    firstSubmittedAt: now - 3 * H,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-07-1',
        versionNumber: 1,
        submittedAt: now - 3 * H,
        isLate: false,
        comment: null,
        files: [file('f-hqcs-07-1', 'tpl-batch-processing.pdf', 'pdf', '1.1 МБ')],
        review: null,
      },
    ],
    events: [
      { id: 'ev-hqcs-07-1', kind: 'Assigned', occurredAt: now - 4 * D, actorName: leadHqCs, detail: 'Олим Назаров' },
      { id: 'ev-hqcs-07-2', kind: 'SubmissionUploaded', occurredAt: now - 3 * H, actorName: 'Олим Назаров', detail: 'Версия 1' },
    ],
  },
  {
    id: 'asn-hqcs-08',
    categoryId: HQ_CS,
    title: 'Работа с базой данных PostgreSQL',
    description: 'Спроектировать схему БД, индексы и написать три аналитических запроса.',
    status: 'InReview',
    source: 'Manual',
    mentorId: 'usr-ros-cat-hq-csharp-2',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now + 2 * D,
    currentDueAt: now + 2 * D,
    assignedAt: now - 6 * D,
    firstSubmittedAt: now - 20 * H,
    reviewStartedAt: now - 1 * H,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-08-1',
        versionNumber: 1,
        submittedAt: now - 20 * H,
        isLate: false,
        comment: 'Индексы приложил отдельным разделом в конце документа.',
        files: [file('f-hqcs-08-1', 'postgres-schema.pdf', 'pdf', '3.0 МБ'), file('f-hqcs-08-2', 'queries-explain.pdf', 'pdf', '0.6 МБ')],
        review: null,
      },
    ],
    events: [
      { id: 'ev-hqcs-08-1', kind: 'Assigned', occurredAt: now - 6 * D, actorName: leadHqCs, detail: 'Дилноза Каримова' },
      { id: 'ev-hqcs-08-2', kind: 'SubmissionUploaded', occurredAt: now - 20 * H, actorName: 'Дилноза Каримова', detail: 'Версия 1' },
      { id: 'ev-hqcs-08-3', kind: 'ReviewStarted', occurredAt: now - 1 * H, actorName: leadHqCs },
    ],
  },
  {
    id: 'asn-hqcs-09',
    categoryId: HQ_CS,
    title: 'Обработка исключений и логирование',
    description: 'Внедрить единый middleware обработки исключений и структурированное логирование.',
    status: 'NeedsRework',
    source: 'Manual',
    mentorId: 'usr-1017',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now - 4 * D,
    currentDueAt: now + 1 * D,
    assignedAt: now - 8 * D,
    firstSubmittedAt: now - 4 * D,
    reviewStartedAt: now - 3 * D,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-09-1',
        versionNumber: 1,
        submittedAt: now - 4 * D,
        isLate: false,
        comment: null,
        files: [file('f-hqcs-09-1', 'exception-middleware.pdf', 'pdf', '1.7 МБ')],
        review: {
          id: 'rev-hqcs-09-1',
          decision: 'NeedsRework',
          comment: 'Middleware не логирует stack trace для 500-х ответов, и чувствительные поля (пароль) попадают в лог необработанными. Поправь маскирование и добавь корреляционный Id в каждую запись.',
          reworkDueAt: now + 1 * D,
          createdAt: now - 3 * D,
          reviewerName: leadHqCs,
        },
      },
    ],
    events: [
      { id: 'ev-hqcs-09-1', kind: 'Assigned', occurredAt: now - 8 * D, actorName: leadHqCs, detail: 'Умед Раджабов' },
      { id: 'ev-hqcs-09-2', kind: 'SubmissionUploaded', occurredAt: now - 4 * D, actorName: 'Умед Раджабов', detail: 'Версия 1' },
      { id: 'ev-hqcs-09-3', kind: 'ReviewStarted', occurredAt: now - 3 * D - H, actorName: leadHqCs },
      { id: 'ev-hqcs-09-4', kind: 'ReviewNeedsRework', occurredAt: now - 3 * D, actorName: leadHqCs },
    ],
  },
  {
    id: 'asn-hqcs-10',
    categoryId: HQ_CS,
    title: 'Работа с файлами и потоками',
    description: 'Реализовать потоковую загрузку/выгрузку крупных файлов без буферизации в память.',
    status: 'InReview',
    source: 'Manual',
    mentorId: 'usr-ros-cat-hq-csharp-3',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now - 5 * D,
    currentDueAt: now - 3 * D,
    assignedAt: now - 9 * D,
    firstSubmittedAt: now - 6 * D,
    reviewStartedAt: now - 2 * H,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-10-1',
        versionNumber: 1,
        submittedAt: now - 6 * D,
        isLate: false,
        comment: null,
        files: [file('f-hqcs-10-1', 'stream-upload-v1.pdf', 'pdf', '0.9 МБ')],
        review: {
          id: 'rev-hqcs-10-1',
          decision: 'NeedsRework',
          comment: 'Файл целиком читается в MemoryStream перед записью — при 50 МБ это выгружает всю память процесса. Перепиши на прямой stream-to-stream copy.',
          reworkDueAt: now - 3 * D,
          createdAt: now - 5 * D,
          reviewerName: leadHqCs,
        },
      },
      {
        id: 'sub-hqcs-10-2',
        versionNumber: 2,
        submittedAt: now - 4 * D,
        isLate: false,
        comment: 'Переписал на CopyToAsync с буфером 80 КБ, добавил тест на файле 200 МБ.',
        files: [file('f-hqcs-10-2', 'stream-upload-v2.pdf', 'pdf', '1.0 МБ')],
        review: null,
      },
    ],
    events: [
      { id: 'ev-hqcs-10-1', kind: 'Assigned', occurredAt: now - 9 * D, actorName: leadHqCs, detail: 'Хуршед Латипов' },
      { id: 'ev-hqcs-10-2', kind: 'SubmissionUploaded', occurredAt: now - 6 * D, actorName: 'Хуршед Латипов', detail: 'Версия 1' },
      { id: 'ev-hqcs-10-3', kind: 'ReviewStarted', occurredAt: now - 5 * D - H, actorName: leadHqCs },
      { id: 'ev-hqcs-10-4', kind: 'ReviewNeedsRework', occurredAt: now - 5 * D, actorName: leadHqCs },
      { id: 'ev-hqcs-10-5', kind: 'SubmissionUploaded', occurredAt: now - 4 * D, actorName: 'Хуршед Латипов', detail: 'Версия 2' },
      { id: 'ev-hqcs-10-6', kind: 'ReviewStarted', occurredAt: now - 2 * H, actorName: leadHqCs },
    ],
  },
  {
    id: 'asn-hqcs-11',
    categoryId: HQ_CS,
    title: 'Рефлексия и атрибуты в C#',
    description: 'Написать простой валидатор на пользовательских атрибутах и System.Reflection.',
    status: 'Overdue',
    source: 'Manual',
    mentorId: 'usr-ros-cat-hq-csharp-1',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now - 1 * D,
    currentDueAt: now - 1 * D,
    assignedAt: now - 8 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: now - 1 * D,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [
      { id: 'ev-hqcs-11-1', kind: 'Assigned', occurredAt: now - 8 * D, actorName: leadHqCs, detail: 'Олим Назаров' },
      { id: 'ev-hqcs-11-2', kind: 'MarkedOverdue', occurredAt: now - 1 * D, actorName: 'Система' },
    ],
  },
  {
    id: 'asn-hqcs-12',
    categoryId: HQ_CS,
    title: 'Введение в SOLID принципы',
    description: 'Отрефакторить учебный сервис уведомлений по принципам SOLID, приложить объяснение каждого шага.',
    status: 'Approved',
    source: 'Manual',
    mentorId: 'usr-1017',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now - 11 * D,
    currentDueAt: now - 11 * D,
    assignedAt: now - 14 * D,
    firstSubmittedAt: now - 12 * D,
    reviewStartedAt: now - 11 * D,
    approvedAt: now - 10 * D,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-12-1',
        versionNumber: 1,
        submittedAt: now - 12 * D,
        isLate: false,
        comment: null,
        files: [file('f-hqcs-12-1', 'solid-refactor.pdf', 'pdf', '2.1 МБ')],
        review: {
          id: 'rev-hqcs-12-1',
          decision: 'Approved',
          comment: 'Хорошая работа, DIP реализован через конструкторную инъекцию корректно.',
          reworkDueAt: null,
          createdAt: now - 10 * D,
          reviewerName: leadHqCs,
        },
      },
    ],
    events: [
      { id: 'ev-hqcs-12-1', kind: 'Assigned', occurredAt: now - 14 * D, actorName: leadHqCs, detail: 'Умед Раджабов' },
      { id: 'ev-hqcs-12-2', kind: 'SubmissionUploaded', occurredAt: now - 12 * D, actorName: 'Умед Раджабов', detail: 'Версия 1' },
      { id: 'ev-hqcs-12-3', kind: 'ReviewStarted', occurredAt: now - 11 * D, actorName: leadHqCs },
      { id: 'ev-hqcs-12-4', kind: 'ReviewApproved', occurredAt: now - 10 * D, actorName: leadHqCs },
    ],
  },
  {
    id: 'asn-hqcs-13',
    categoryId: HQ_CS,
    title: 'Кэширование с IMemoryCache и Redis',
    description: 'Добавить двухуровневое кэширование справочников: IMemoryCache + Redis fallback.',
    status: 'Approved',
    source: 'Auto',
    mentorId: 'usr-ros-cat-hq-csharp-2',
    assignedById: leadHqCs,
    topicAssignmentId: 'tpa-hqcs-cache',
    initialDueAt: now - 1 * D,
    currentDueAt: now - 1 * D,
    assignedAt: now - 5 * D,
    firstSubmittedAt: now - 3 * D,
    reviewStartedAt: now - 2 * D,
    approvedAt: now - 2 * D,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [
      {
        id: 'sub-hqcs-13-1',
        versionNumber: 1,
        submittedAt: now - 3 * D,
        isLate: false,
        comment: null,
        files: [file('f-hqcs-13-1', 'caching-layer.pdf', 'pdf', '1.4 МБ')],
        review: {
          id: 'rev-hqcs-13-1',
          decision: 'Approved',
          comment: null,
          reworkDueAt: null,
          createdAt: now - 2 * D,
          reviewerName: leadHqCs,
        },
      },
    ],
    events: [
      { id: 'ev-hqcs-13-1', kind: 'Assigned', occurredAt: now - 5 * D, actorName: leadHqCs, detail: 'Дилноза Каримова' },
      { id: 'ev-hqcs-13-2', kind: 'SubmissionUploaded', occurredAt: now - 3 * D, actorName: 'Дилноза Каримова', detail: 'Версия 1' },
      { id: 'ev-hqcs-13-3', kind: 'ReviewStarted', occurredAt: now - 2 * D - H, actorName: leadHqCs },
      { id: 'ev-hqcs-13-4', kind: 'ReviewApproved', occurredAt: now - 2 * D, actorName: leadHqCs },
    ],
  },
  {
    id: 'asn-hqcs-14',
    categoryId: HQ_CS,
    title: 'Работа с NuGet пакетами',
    description: 'Собрать и опубликовать внутренний NuGet-пакет с общими DTO.',
    status: 'Cancelled',
    source: 'Manual',
    mentorId: 'usr-ros-cat-hq-csharp-3',
    assignedById: leadHqCs,
    topicAssignmentId: null,
    initialDueAt: now - 12 * D,
    currentDueAt: now - 12 * D,
    assignedAt: now - 16 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: now - 15 * D,
    cancelReason: 'Тема объединена с заданием «Кэширование» — отдельный пакет больше не нужен.',
    allowLateSubmission: true,
    submissions: [],
    events: [
      { id: 'ev-hqcs-14-1', kind: 'Assigned', occurredAt: now - 16 * D, actorName: leadHqCs, detail: 'Хуршед Латипов' },
      { id: 'ev-hqcs-14-2', kind: 'Cancelled', occurredAt: now - 15 * D, actorName: leadHqCs, detail: 'Тема объединена с заданием «Кэширование» — отдельный пакет больше не нужен.' },
    ],
  },
];

/* -------------------------- cat-hq-frontend (чужая категория, тот же Branch) ------------------------- */

const HQ_FE = 'cat-hq-frontend';
const leadHqFe = CATEGORY_LEAD_NAME[HQ_FE];

const hqFrontendAssignments: LeadAssignmentRecord[] = [
  {
    id: 'asn-hqfe-01',
    categoryId: HQ_FE,
    title: 'Компонент авторизации на React',
    description: 'Форма логина с валидацией и обработкой ошибок API.',
    status: 'Assigned',
    source: 'Manual',
    mentorId: 'usr-1003',
    assignedById: leadHqFe,
    topicAssignmentId: null,
    initialDueAt: now + 2 * D,
    currentDueAt: now + 2 * D,
    assignedAt: now - 1 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: false,
    submissions: [],
    events: [{ id: 'ev-hqfe-01-1', kind: 'Assigned', occurredAt: now - 1 * D, actorName: leadHqFe, detail: 'Нилуфар Каримова' }],
  },
  {
    id: 'asn-hqfe-02',
    categoryId: HQ_FE,
    title: 'Дизайн-система: кнопки и формы',
    description: 'Собрать базовый набор UI-примитивов по макету.',
    status: 'Submitted',
    source: 'Manual',
    mentorId: 'usr-ros-cat-hq-frontend-1',
    assignedById: leadHqFe,
    topicAssignmentId: null,
    initialDueAt: now + 1 * D,
    currentDueAt: now + 1 * D,
    assignedAt: now - 3 * D,
    firstSubmittedAt: now - 5 * H,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: false,
    submissions: [{ id: 'sub-hqfe-02-1', versionNumber: 1, submittedAt: now - 5 * H, isLate: false, comment: null, files: [file('f-hqfe-02-1', 'ui-kit.pdf', 'pdf', '1.8 МБ')], review: null }],
    events: [{ id: 'ev-hqfe-02-1', kind: 'SubmissionUploaded', occurredAt: now - 5 * H, actorName: 'Наргис Файзуллоева', detail: 'Версия 1' }],
  },
  {
    id: 'asn-hqfe-03',
    categoryId: HQ_FE,
    title: 'Мобильный экран онбординга',
    description: 'Адаптивная вёрстка экрана онбординга под 375–1440px.',
    status: 'Overdue',
    source: 'Auto',
    mentorId: 'usr-ros-cat-hq-frontend-2',
    assignedById: leadHqFe,
    topicAssignmentId: 'tpa-hqfe-onboarding',
    initialDueAt: now - 2 * D,
    currentDueAt: now - 2 * D,
    assignedAt: now - 7 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: now - 2 * D,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: false,
    submissions: [],
    events: [{ id: 'ev-hqfe-03-1', kind: 'MarkedOverdue', occurredAt: now - 2 * D, actorName: 'Система' }],
  },
  {
    id: 'asn-hqfe-04',
    categoryId: HQ_FE,
    title: 'Оптимизация загрузки изображений',
    description: 'Lazy-loading и responsive srcset для карточек каталога.',
    status: 'Approved',
    source: 'Manual',
    mentorId: 'usr-1003',
    assignedById: leadHqFe,
    topicAssignmentId: null,
    initialDueAt: now - 4 * D,
    currentDueAt: now - 4 * D,
    assignedAt: now - 8 * D,
    firstSubmittedAt: now - 5 * D,
    reviewStartedAt: now - 4 * D,
    approvedAt: now - 4 * D,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: false,
    submissions: [{ id: 'sub-hqfe-04-1', versionNumber: 1, submittedAt: now - 5 * D, isLate: false, comment: null, files: [file('f-hqfe-04-1', 'image-optimization.pdf', 'pdf', '0.8 МБ')], review: { id: 'rev-hqfe-04-1', decision: 'Approved', comment: null, reworkDueAt: null, createdAt: now - 4 * D, reviewerName: leadHqFe } }],
    events: [{ id: 'ev-hqfe-04-1', kind: 'ReviewApproved', occurredAt: now - 4 * D, actorName: leadHqFe }],
  },
];

/* --------------------- cat-khu-csharp (та же Category name «C#», другой Branch) ------------------- */

const KHU_CS = 'cat-khu-csharp';
const leadKhuCs = CATEGORY_LEAD_NAME[KHU_CS];

const khuCsharpAssignments: LeadAssignmentRecord[] = [
  {
    id: 'asn-khucs-01',
    categoryId: KHU_CS,
    title: 'Коллекции и Generics в C#',
    description: 'Реализовать типобезопасную обобщённую очередь с приоритетом.',
    status: 'Assigned',
    source: 'Manual',
    mentorId: 'usr-1018',
    assignedById: leadKhuCs,
    topicAssignmentId: null,
    initialDueAt: now + 4 * D,
    currentDueAt: now + 4 * D,
    assignedAt: now - 1 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: 'ev-khucs-01-1', kind: 'Assigned', occurredAt: now - 1 * D, actorName: leadKhuCs, detail: 'Мадина Юлдашева' }],
  },
  {
    id: 'asn-khucs-02',
    categoryId: KHU_CS,
    title: 'ASP.NET Core Middleware pipeline',
    description: 'Написать собственный middleware ограничения частоты запросов.',
    status: 'Submitted',
    source: 'Manual',
    mentorId: 'usr-ros-cat-khu-csharp-1',
    assignedById: leadKhuCs,
    topicAssignmentId: null,
    initialDueAt: now + 1 * D,
    currentDueAt: now + 1 * D,
    assignedAt: now - 3 * D,
    firstSubmittedAt: now - 2 * H,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [{ id: 'sub-khucs-02-1', versionNumber: 1, submittedAt: now - 2 * H, isLate: false, comment: null, files: [file('f-khucs-02-1', 'rate-limit-middleware.pdf', 'pdf', '1.0 МБ')], review: null }],
    events: [{ id: 'ev-khucs-02-1', kind: 'SubmissionUploaded', occurredAt: now - 2 * H, actorName: 'Искандар Валиев', detail: 'Версия 1' }],
  },
  {
    id: 'asn-khucs-03',
    categoryId: KHU_CS,
    title: 'Индексы и планы запросов PostgreSQL',
    description: 'Оптимизировать три медленных запроса, приложить EXPLAIN ANALYZE.',
    status: 'Overdue',
    source: 'Auto',
    mentorId: 'usr-ros-cat-khu-csharp-2',
    assignedById: leadKhuCs,
    topicAssignmentId: 'tpa-khucs-indexes',
    initialDueAt: now - 1 * D,
    currentDueAt: now - 1 * D,
    assignedAt: now - 6 * D,
    firstSubmittedAt: null,
    reviewStartedAt: null,
    approvedAt: null,
    overdueAt: now - 1 * D,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [],
    events: [{ id: 'ev-khucs-03-1', kind: 'MarkedOverdue', occurredAt: now - 1 * D, actorName: 'Система' }],
  },
  {
    id: 'asn-khucs-04',
    categoryId: KHU_CS,
    title: 'Введение в Dependency Injection',
    description: 'Перевести статический сервис на встроенный DI-контейнер .NET.',
    status: 'Approved',
    source: 'Manual',
    mentorId: 'usr-1018',
    assignedById: leadKhuCs,
    topicAssignmentId: null,
    initialDueAt: now - 6 * D,
    currentDueAt: now - 6 * D,
    assignedAt: now - 10 * D,
    firstSubmittedAt: now - 7 * D,
    reviewStartedAt: now - 6 * D,
    approvedAt: now - 6 * D,
    overdueAt: null,
    cancelledAt: null,
    cancelReason: null,
    allowLateSubmission: true,
    submissions: [{ id: 'sub-khucs-04-1', versionNumber: 1, submittedAt: now - 7 * D, isLate: false, comment: null, files: [file('f-khucs-04-1', 'di-refactor.pdf', 'pdf', '1.2 МБ')], review: { id: 'rev-khucs-04-1', decision: 'Approved', comment: null, reworkDueAt: null, createdAt: now - 6 * D, reviewerName: leadKhuCs } }],
    events: [{ id: 'ev-khucs-04-1', kind: 'ReviewApproved', occurredAt: now - 6 * D, actorName: leadKhuCs }],
  },
];

export const LEAD_ASSIGNMENTS: LeadAssignmentRecord[] = [
  ...hqCsharpAssignments,
  ...hqFrontendAssignments,
  ...khuCsharpAssignments,
];

export const LEAD_ASSIGNMENT_STATUS_LABEL: Record<LeadAssignmentStatus, string> = {
  Draft: 'Черновик',
  Suggested: 'Предложено',
  Assigned: 'Назначено',
  Submitted: 'Отправлено',
  InReview: 'На проверке',
  NeedsRework: 'На доработке',
  Overdue: 'Просрочено',
  Approved: 'Одобрено',
  Cancelled: 'Отменено',
};
