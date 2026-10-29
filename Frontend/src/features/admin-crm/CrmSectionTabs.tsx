/** Переключатель разделов CRM-страницы: «Группы», «Отчёты», «Связи с RAVAND». */
export function CrmSectionTabs<T extends string>({ sections, value, onChange }: {
  sections: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}): JSX.Element {
  return (
    <div className="inline-flex rounded-control border border-line bg-surface p-0.5" role="tablist" aria-label="Раздел">
      {sections.map((s) => (
        <button
          key={s.value}
          type="button"
          role="tab"
          aria-selected={value === s.value}
          onClick={() => { onChange(s.value); }}
          className={`rounded-[7px] px-3.5 py-1.5 text-[13px] font-medium transition-colors ${value === s.value ? 'bg-surface-muted text-ink shadow-sm' : 'text-ink-muted hover:text-ink-secondary'}`}
        >
          {s.label}
        </button>
      ))}
    </div>
  );
}
