const TONES = {
  neutral: 'bg-surface-muted text-muted',
  primary: 'bg-primary-soft text-primary',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  info: 'bg-info-soft text-info',
};

export default function Badge({ tone = 'neutral', children }) {
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>
      {children}
    </span>
  );
}
