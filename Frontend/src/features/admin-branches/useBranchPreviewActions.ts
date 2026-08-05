import { useCallback, useState } from 'react';

import { useToast } from '../../shared/overlays';
import * as store from './branchPreviewStore';
import type { PreviewBranchDetails } from './branchPresentation';

const MOCK_DELAY_MS = 450;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export interface UseBranchPreviewActionsResult {
  isSubmitting: boolean;
  createBranch: (input: store.CreateBranchInput) => Promise<PreviewBranchDetails>;
  updateBranch: (id: string, input: store.UpdateBranchInput) => Promise<PreviewBranchDetails>;
  assignAdmin: (branchId: string, adminUserId: string) => Promise<PreviewBranchDetails>;
  changeAdmin: (branchId: string, input: store.ChangeBranchAdminInput) => Promise<PreviewBranchDetails>;
  activateBranch: (id: string) => Promise<PreviewBranchDetails>;
  deactivateBranch: (id: string) => Promise<PreviewBranchDetails>;
}

/** Единая точка mock-мутаций Branches — задержка + `branchPreviewStore` + toast (раздел 30/38 промпта). */
export function useBranchPreviewActions(): UseBranchPreviewActionsResult {
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

  const createBranch = useCallback(
    async (input: store.CreateBranchInput): Promise<PreviewBranchDetails> => {
      const created = await run(() => store.createBranchPreview(input));
      toast.success(
        input.adminUserId !== null ? `Филиал ${created.name} создан, администратор назначен` : `Филиал ${created.name} создан без назначенного администратора`,
        { title: 'Филиал добавлен' },
      );
      return created;
    },
    [run, toast],
  );

  const updateBranch = useCallback(
    async (id: string, input: store.UpdateBranchInput): Promise<PreviewBranchDetails> => {
      const updated = await run(() => store.updateBranchPreview(id, input));
      toast.success('Данные филиала обновлены');
      return updated;
    },
    [run, toast],
  );

  const assignAdmin = useCallback(
    async (branchId: string, adminUserId: string): Promise<PreviewBranchDetails> => {
      const updated = await run(() => store.assignBranchAdminPreview(branchId, adminUserId));
      toast.success('Администратор филиала назначен');
      return updated;
    },
    [run, toast],
  );

  const changeAdmin = useCallback(
    async (branchId: string, input: store.ChangeBranchAdminInput): Promise<PreviewBranchDetails> => {
      const updated = await run(() => store.changeBranchAdminPreview(branchId, input));
      toast.success('Администратор филиала изменён');
      return updated;
    },
    [run, toast],
  );

  const activateBranch = useCallback(
    async (id: string): Promise<PreviewBranchDetails> => {
      const updated = await run(() => store.activateBranchPreview(id));
      toast.success('Филиал активирован');
      return updated;
    },
    [run, toast],
  );

  const deactivateBranch = useCallback(
    async (id: string): Promise<PreviewBranchDetails> => {
      const updated = await run(() => store.deactivateBranchPreview(id));
      toast.warning('Филиал деактивирован');
      return updated;
    },
    [run, toast],
  );

  return { isSubmitting, createBranch, updateBranch, assignAdmin, changeAdmin, activateBranch, deactivateBranch };
}
