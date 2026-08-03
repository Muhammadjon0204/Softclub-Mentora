/** Демо-данные страницы /admin/reports (UI-прототип, раздел 10 сессии). */

export const PREVIEW_REPORT_PERIOD_LABEL = '1 – 7 августа 2026';

export const PREVIEW_REPORT_KPIS: {
  key: string;
  label: string;
  value: string;
  deltaPct: number;
  deltaTone: 'positive' | 'negative';
}[] = [
  { key: 'completion', label: 'Процент завершения', value: '78%', deltaPct: 12, deltaTone: 'positive' },
  { key: 'overdue', label: 'Доля просроченных', value: '8.6%', deltaPct: 3.2, deltaTone: 'negative' },
  { key: 'firstPass', label: 'Одобрено с первой попытки', value: '68%', deltaPct: 7, deltaTone: 'positive' },
  { key: 'reviewTime', label: 'Среднее время проверки', value: '2.4 дня', deltaPct: -5.6, deltaTone: 'positive' },
];

/** Динамика завершения — line chart, 7 точек. */
export const PREVIEW_COMPLETION_TREND: { label: string; value: number }[] = [
  { label: '1 авг', value: 62 },
  { label: '2 авг', value: 65 },
  { label: '3 авг', value: 70 },
  { label: '4 авг', value: 68 },
  { label: '5 авг', value: 74 },
  { label: '6 авг', value: 76 },
  { label: '7 авг', value: 78 },
];

/** Сравнение филиалов — horizontal bar chart. */
export const PREVIEW_BRANCH_COMPARISON: { branchName: string; completionPct: number }[] = [
  { branchName: 'Главный офис', completionPct: 85 },
  { branchName: 'Филиал Худжанд', completionPct: 78 },
  { branchName: 'Филиал Бохтар', completionPct: 60 },
];

/** Результаты категорий — компактные grouped bars. */
export const PREVIEW_CATEGORY_RESULTS: { categoryName: string; completionPct: number; overduePct: number }[] = [
  { categoryName: 'C#', completionPct: 88, overduePct: 4 },
  { categoryName: 'Frontend', completionPct: 82, overduePct: 6 },
  { categoryName: 'Python', completionPct: 79, overduePct: 5 },
  { categoryName: 'UI/UX Design', completionPct: 54, overduePct: 18 },
  { categoryName: 'QA', completionPct: 90, overduePct: 2 },
  { categoryName: 'DevOps', completionPct: 86, overduePct: 3 },
];

/** Нагрузка менторов — bar list. */
export const PREVIEW_MENTOR_LOAD: { mentorName: string; activeAssignments: number }[] = [
  { mentorName: 'Рустам Раҳимов', activeAssignments: 9 },
  { mentorName: 'Гулнора Саидова', activeAssignments: 8 },
  { mentorName: 'Джамшед Юлдашев', activeAssignments: 7 },
  { mentorName: 'Зарина Умарова', activeAssignments: 6 },
  { mentorName: 'Хуршед Абдуллоев', activeAssignments: 5 },
];

export const PREVIEW_AI_SUMMARY = {
  generatedLabel: 'Сформировано 5 минут назад',
  text: 'На этой неделе общий процент завершения заданий увеличился на 12% по сравнению с предыдущей неделей и составил 78%. Доля просроченных заданий снизилась до 8.6%, что является хорошим показателем. Филиал «Главный офис» демонстрирует лучшие результаты по завершению заданий, а категория «UI/UX Design» требует внимания — там нет назначенного Lead и заметно выше доля просрочек. Рекомендуется в первую очередь назначить руководителя направления для UI/UX Design.',
};
