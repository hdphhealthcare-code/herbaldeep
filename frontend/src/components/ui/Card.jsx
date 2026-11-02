export default function Card({ title, action, children, className = '', padded = true }) {
  return (
    <section className={`rounded-xl border border-border bg-surface shadow-card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="text-sm font-semibold text-foreground">{title}</h2>
          {action}
        </header>
      )}
      <div className={padded ? 'p-5' : ''}>{children}</div>
    </section>
  );
}
