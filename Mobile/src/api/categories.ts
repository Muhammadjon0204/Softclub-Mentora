import { apiGet, apiGetAll, apiSend } from '@/lib/api';

export interface Category {
  id: string;
  branchId: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  concurrencyToken: string;
  branch?: { id: string; name: string } | null;
}

export interface CategorySettings {
  categoryId: string;
  timeZoneId: string;
  defaultAssignmentDueDays: number;
  /** `HH:mm:ss` */
  defaultDueTimeLocal: string;
  deadlineReminderHours: number;
  allowLateSubmission: boolean;
  concurrencyToken: string;
}

export const listCategories = () => apiGetAll<Category>('/api/v1/categories');

export const createCategory = (body: { name: string; description: string | null }, branchId?: string | null) =>
  apiSend<Category>('POST', '/api/v1/categories', body, branchId);

export const updateCategory = (category: Category, name: string, description: string | null) =>
  apiSend<Category>('PUT', `/api/v1/categories/${category.id}`, { name, description, concurrencyToken: category.concurrencyToken }, category.branchId);

export const setCategoryActive = (category: Category, active: boolean, confirmActiveUsers = false) =>
  apiSend<Category>(
    'POST',
    `/api/v1/categories/${category.id}/${active ? 'activate' : 'deactivate'}`,
    active ? { concurrencyToken: category.concurrencyToken } : { concurrencyToken: category.concurrencyToken, confirmActiveUsers },
    category.branchId,
  );

export const getCategorySettings = (id: string) => apiGet<CategorySettings>(`/api/v1/categories/${id}/settings`);

export const updateCategorySettings = (settings: CategorySettings, branchId: string) =>
  apiSend<CategorySettings>(
    'PUT',
    `/api/v1/categories/${settings.categoryId}/settings`,
    {
      timeZoneId: settings.timeZoneId,
      defaultAssignmentDueDays: settings.defaultAssignmentDueDays,
      defaultDueTimeLocal: settings.defaultDueTimeLocal,
      deadlineReminderHours: settings.deadlineReminderHours,
      allowLateSubmission: settings.allowLateSubmission,
      concurrencyToken: settings.concurrencyToken,
    },
    branchId,
  );
