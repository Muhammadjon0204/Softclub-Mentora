import type { ReactNode } from 'react';

/** Семантика delta-badge на KPI-карточке: направление роста ≠ «хорошо/плохо» само по себе. */
export type DeltaTone = 'positive' | 'negative' | 'neutral';

export interface KpiCardSpec {
  key: string;
  icon: ReactNode;
  label: string;
  value: string;
  deltaPct: number;
  deltaTone: DeltaTone;
  tooltip: string;
  sparkline: number[];
  sparklineColor: string;
}

/** Единая палитра тонов для dot+text статусов и лент активности по всему Dashboard. */
export type SemanticTone = 'neutral' | 'success' | 'info' | 'warning' | 'danger';

export const TONE_DOT_CLASS: Record<SemanticTone, string> = {
  neutral: 'bg-ink-disabled',
  success: 'bg-success',
  info: 'bg-info',
  warning: 'bg-warning',
  danger: 'bg-danger',
};

export const TONE_TEXT_CLASS: Record<SemanticTone, string> = {
  neutral: 'text-ink-secondary',
  success: 'text-success',
  info: 'text-info',
  warning: 'text-warning',
  danger: 'text-danger',
};
