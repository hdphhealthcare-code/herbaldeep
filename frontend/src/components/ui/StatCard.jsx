const TONES = {
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export default function StatCard({ label, value, icon: Icon, tone = 'primary', hint }) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4 shadow-card">
      {Icon && (
        <span className={`rounded-lg p-3 ${TONES[tone]}`}>
          <Icon className="h-5 w-5" />
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate text-xs text-muted">{label}</p>
        <p className="text-2xl font-semibold leading-tight text-foreground">{value ?? 0}</p>
        {hint && <p className="text-xs text-muted">{hint}</p>}
      </div>
    </div>
  );
}
