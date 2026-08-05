import { useState } from 'react';

import { Modal } from '../../shared/overlays';
import { useToast } from '../../shared/overlays';
import { Button } from '../../shared/ui/Button';
import { FormCheckbox, FormField, FormSelect } from '../../shared/ui/FormField';
import { REPORT_PERIOD_LABEL } from './reportPresentation';

const FORMAT_OPTIONS = [
  { value: 'csv', label: 'CSV' },
  { value: 'pdf', label: 'PDF' },
] as const;

const SECTION_OPTIONS = [
  { key: 'kpis', label: 'Ключевые показатели' },
  { key: 'trend', label: 'Динамика завершения' },
  { key: 'branches', label: 'Сравнение филиалов' },
  { key: 'categories', label: 'Результаты категорий' },
] as const;

export interface ExportReportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchLabel: string;
  categoryLabel: string;
}

/**
 * Preview-only экспорт (раздел 28 промпта): ТЗ не определяет формат экспорта
 * отчётов — реального production contract здесь нет, backend не создаётся,
 * файл не скачивается.
 */
export function ExportReportModal({ open, onOpenChange, branchLabel, categoryLabel }: ExportReportModalProps): JSX.Element {
  const toast = useToast();
  const [format, setFormat] = useState<(typeof FORMAT_OPTIONS)[number]['value']>('csv');
  const [sections, setSections] = useState<Set<string>>(new Set(SECTION_OPTIONS.map((s) => s.key)));
  const [isSubmitting, setIsSubmitting] = useState(false);

  function toggleSection(key: string): void {
    setSections((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSubmit(): Promise<void> {
    setIsSubmitting(true);
    try {
      await new Promise((resolve) => { window.setTimeout(resolve, 450); });
      toast.success('Экспорт подготовлен в preview-режиме');
      onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Экспортировать отчёт"
      description="Preview-режим — файл не создаётся"
      size="sm"
      preventClose={isSubmitting}
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button variant="secondary" disabled={isSubmitting} onClick={() => { onOpenChange(false); }}>
            Отмена
          </Button>
          <Button variant="primary" isLoading={isSubmitting} onClick={() => { void handleSubmit(); }}>
            Экспортировать
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <FormField label="Формат" htmlFor="export-format">
          <FormSelect id="export-format" value={format} onChange={(event) => { setFormat(event.target.value as (typeof FORMAT_OPTIONS)[number]['value']); }}>
            {FORMAT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </FormSelect>
        </FormField>

        <dl className="divide-y divide-divider rounded-control border border-line px-3">
          <div className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-ink-muted">Период</span>
            <span className="font-medium text-ink">{REPORT_PERIOD_LABEL}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-ink-muted">Филиал</span>
            <span className="font-medium text-ink">{branchLabel}</span>
          </div>
          <div className="flex items-center justify-between py-2 text-[13px]">
            <span className="text-ink-muted">Категория</span>
            <span className="font-medium text-ink">{categoryLabel}</span>
          </div>
        </dl>

        <div>
          <span className="mb-2 block text-[12.5px] font-medium text-ink-secondary">Включаемые секции</span>
          <div className="space-y-2.5">
            {SECTION_OPTIONS.map((option) => (
              <FormCheckbox key={option.key} label={option.label} checked={sections.has(option.key)} onChange={() => { toggleSection(option.key); }} />
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
