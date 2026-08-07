export interface SelectOption {
  value: string;
  label: string;
  /** Короткая вторичная подпись — например email кандидата рядом с ФИО. */
  description?: string;
  disabled?: boolean;
}
