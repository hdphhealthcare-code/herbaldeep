// Status tabs (Xpressbees style): quiet grey text, the active tab is dark with an orange underline.
// tabs: [{ value, label, count? }]
export default function Tabs({ tabs, value, onChange, showCount = true }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-3">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`relative whitespace-nowrap px-3.5 py-3.5 text-sm transition ${active ? 'font-semibold text-foreground' : 'font-medium text-muted hover:text-foreground'}`}
          >
            {t.label}
            {showCount && t.count !== undefined && t.count > 0 && (
              <span className={`num ml-1.5 text-xs ${active ? 'text-primary' : 'text-muted/80'}`}>{t.count}</span>
            )}
            {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}
