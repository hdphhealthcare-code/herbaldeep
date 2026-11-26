export default function Card({ title, action, children, className = '', padded = true }) {
  return (
    <section className={`rounded-2xl border border-border bg-surface shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-tight text-foreground">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}
