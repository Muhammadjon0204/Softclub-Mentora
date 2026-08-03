/** Демо-данные страницы /admin/categories (UI-прототип, раздел 8 сессии). */

export type PreviewCategoryColor = 'indigo' | 'blue' | 'cyan' | 'violet';

export interface PreviewCategory {
  id: string;
  name: string;
  branchName: string;
  colorToken: PreviewCategoryColor;
  leadName: string | null;
  mentorsCount: number;
  activeAssignments: number;
  pendingReview: number;
  healthPct: number;
  isActive: boolean;
}

export const PREVIEW_CATEGORIES: PreviewCategory[] = [
  {
    id: 'cat-csharp',
    name: 'C#',
    branchName: 'Главный офис',
    colorToken: 'indigo',
    leadName: 'Сухроб Холов',
    mentorsCount: 5,
    activeAssignments: 12,
    pendingReview: 3,
    healthPct: 94,
    isActive: true,
  },
  {
    id: 'cat-frontend',
    name: 'Frontend',
    branchName: 'Главный офис',
    colorToken: 'blue',
    leadName: 'Шахноза Мирзоева',
    mentorsCount: 6,
    activeAssignments: 15,
    pendingReview: 5,
    healthPct: 91,
    isActive: true,
  },
  {
    id: 'cat-python',
    name: 'Python',
    branchName: 'Филиал Худжанд',
    colorToken: 'cyan',
    leadName: 'Далер Сафаров',
    mentorsCount: 4,
    activeAssignments: 9,
    pendingReview: 2,
    healthPct: 88,
    isActive: true,
  },
  {
    id: 'cat-uiux',
    name: 'UI/UX Design',
    branchName: 'Филиал Бохтар',
    colorToken: 'violet',
    leadName: null,
    mentorsCount: 2,
    activeAssignments: 3,
    pendingReview: 1,
    healthPct: 58,
    isActive: true,
  },
  {
    id: 'cat-mobile',
    name: 'Mobile Development',
    branchName: 'Главный офис',
    colorToken: 'indigo',
    leadName: 'Умедчода Парвиз',
    mentorsCount: 3,
    activeAssignments: 7,
    pendingReview: 2,
    healthPct: 85,
    isActive: true,
  },
  {
    id: 'cat-qa',
    name: 'QA',
    branchName: 'Филиал Худжанд',
    colorToken: 'blue',
    leadName: 'Нигина Джалолова',
    mentorsCount: 3,
    activeAssignments: 6,
    pendingReview: 1,
    healthPct: 90,
    isActive: true,
  },
  {
    id: 'cat-devops',
    name: 'DevOps',
    branchName: 'Главный офис',
    colorToken: 'cyan',
    leadName: 'Комилжон Ибрагимов',
    mentorsCount: 2,
    activeAssignments: 4,
    pendingReview: 1,
    healthPct: 93,
    isActive: true,
  },
  {
    id: 'cat-data',
    name: 'Data Science',
    branchName: 'Филиал Худжанд',
    colorToken: 'violet',
    leadName: 'Гулнора Саидова',
    mentorsCount: 1,
    activeAssignments: 2,
    pendingReview: 0,
    healthPct: 80,
    isActive: true,
  },
];
