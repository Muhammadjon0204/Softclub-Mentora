export interface PreviewTab {
  key: string;
  label: string;
}

interface PreviewTabsProps {
  tabs: PreviewTab[];
  active: string;
  onChange: (key: string) => void;
}

/** Горизонтальные табы (Настройки и, при необходимости, другие preview-страницы). */
export function PreviewTabs({ tabs, active, onChange }: PreviewTabsProps): JSX.Element {
  return (
    <div role="tablist" aria-label="Разделы" className="flex flex-wrap gap-1 border-b border-divider">
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => {
              onChange(tab.key);
            }}
            className={`relative px-3.5 py-2.5 text-sm font-medium transition ${
              isActive ? 'text-brand' : 'text-ink-secondary hover:text-ink'
            }`}
          >
            {tab.label}
            {isActive ? <span aria-hidden="true" className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-brand" /> : null}
          </button>
        );
      })}
    </div>
  );
}
