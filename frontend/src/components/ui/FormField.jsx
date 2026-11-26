const Wrapper = ({ label, error, hint, required, children, className = '' }) => (
  <label className={`block ${className}`}>
    {label && (
      <span className="mb-1 block text-sm font-medium text-foreground">
        {label} {required && <span className="text-danger">*</span>}
      </span>
    )}
    {children}
    {hint && !error && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    {error && <span className="mt-1 block text-xs text-danger">{error}</span>}
  </label>
);

export function Input({ label, error, hint, className, wrapperClass, ...props }) {
  return (
    <Wrapper label={label} error={error} hint={hint} required={props.required} className={wrapperClass}>
      <input className={`input-base ${className || ''}`} {...props} />
    </Wrapper>
  );
}

export function Textarea({ label, error, hint, className, wrapperClass, rows = 3, ...props }) {
  return (
    <Wrapper label={label} error={error} hint={hint} required={props.required} className={wrapperClass}>
      <textarea rows={rows} className={`input-base ${className || ''}`} {...props} />
    </Wrapper>
  );
}

export function Select({ label, error, hint, options = [], placeholder, className, wrapperClass, ...props }) {
  return (
    <Wrapper label={label} error={error} hint={hint} required={props.required} className={wrapperClass}>
      <select className={`input-base ${className || ''}`} {...props}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>{o.label}</option>
        ))}
      </select>
    </Wrapper>
  );
}

export function Checkbox({ label, ...props }) {
  return (
    <label className="flex items-center gap-2 text-sm text-foreground">
      <input type="checkbox" className="h-4 w-4 rounded border-border accent-primary" {...props} />
      {label}
    </label>
  );
}
