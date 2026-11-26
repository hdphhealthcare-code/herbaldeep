import { Loader2 } from 'lucide-react';

const VARIANTS = {
  primary: 'bg-primary text-primary-foreground shadow-glow hover:bg-primary-hover',
  secondary: 'bg-surface text-foreground border border-border hover:border-foreground/25 hover:bg-surface-muted',
  soft: 'bg-primary-soft text-primary hover:bg-primary-soft/70',
  danger: 'bg-danger text-primary-foreground hover:bg-danger/90',
  ghost: 'text-muted hover:bg-surface-muted hover:text-foreground',
};
const SIZES = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2.5 text-sm' };

export default function Button({
  children, variant = 'primary', size = 'md', loading = false, icon: Icon, className = '', disabled, ...props
}) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  );
}
