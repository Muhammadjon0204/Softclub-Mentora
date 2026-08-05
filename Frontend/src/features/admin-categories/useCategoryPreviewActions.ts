import { useCallback, useState } from 'react';

import { useToast } from '../../shared/overlays';
import * as store from './categoryPreviewStore';
import type { PreviewCategoryDetails } from './categoryPresentation';

const MOCK_DELAY_MS = 450;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export interface UseCategoryPreviewActionsResult {
  isSubmitting: boolean;
  createCategory: (input: store.CreateCategoryInput) => Promise<PreviewCategoryDetails>;
  updateCategory: (id: string, input: store.UpdateCategoryInput) => Promise<PreviewCategoryDetails>;
  assignLead: (categoryId: string, leadUserId: string) => Promise<PreviewCategoryDetails>;
  changeLead: (categoryId: string, input: store.ChangeCategoryLeadInput) => Promise<PreviewCategoryDetails>;
  activateCategory: (id: string) => Promise<PreviewCategoryDetails>;
  deactivateCategory: (id: string) => Promise<PreviewCategoryDetails>;
}

/** Единая точка mock-мутаций Categories — задержка + `categoryPreviewStore` + toast (тот же паттерн, что Users/Branches). */
export function useCategoryPreviewActions(): UseCategoryPreviewActionsResult {
  const toast = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const run = useCallback(async <T>(action: () => T): Promise<T> => {
    setIsSubmitting(true);
    try {
      await delay(MOCK_DELAY_MS);
      return action();
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const createCategory = useCallback(
    async (input: store.CreateCategoryInput): Promise<PreviewCategoryDetails> => {
      const created = await run(() => store.createCategoryPreview(input));
      toast.success(input.leadUserId !== null ? `Направление ${created.name} создано, руководитель назначен` : `Направление ${created.name} создано без руководителя`, { title: 'Направление создано' });
      return created;
    },
    [run, toast],
  );

  const updateCategory = useCallback(
    async (id: string, input: store.UpdateCategoryInput): Promise<PreviewCategoryDetails> => {
      const updated = await run(() => store.updateCategoryPreview(id, input));
      toast.success('Изменения сохранены');
      return updated;
    },
    [run, toast],
  );

  const assignLead = useCallback(
    async (categoryId: string, leadUserId: string): Promise<PreviewCategoryDetails> => {
      const updated = await run(() => store.assignCategoryLeadPreview(categoryId, leadUserId));
      toast.success('Руководитель направления назначен');
      return updated;
    },
    [run, toast],
  );

  const changeLead = useCallback(
    async (categoryId: string, input: store.ChangeCategoryLeadInput): Promise<PreviewCategoryDetails> => {
      const updated = await run(() => store.changeCategoryLeadPreview(categoryId, input));
      toast.success('Руководитель направления изменён');
      return updated;
    },
    [run, toast],
  );

  const activateCategory = useCallback(
    async (id: string): Promise<PreviewCategoryDetails> => {
      const updated = await run(() => store.activateCategoryPreview(id));
      toast.success('Направление активировано');
      return updated;
    },
    [run, toast],
  );

  const deactivateCategory = useCallback(
    async (id: string): Promise<PreviewCategoryDetails> => {
      const updated = await run(() => store.deactivateCategoryPreview(id));
      toast.warning('Направление деактивировано');
      return updated;
    },
    [run, toast],
  );

  return { isSubmitting, createCategory, updateCategory, assignLead, changeLead, activateCategory, deactivateCategory };
}
