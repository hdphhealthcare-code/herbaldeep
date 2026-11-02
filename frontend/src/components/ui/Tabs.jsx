// Shiprocket-style status tabs. tabs: [{ value, label, count? }]
export default function Tabs({ tabs, value, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-border px-2">
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            onClick={() => onChange(t.value)}
            className={`whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium transition ${
              active ? 'border-primary text-primary' : 'border-transparent text-muted hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
