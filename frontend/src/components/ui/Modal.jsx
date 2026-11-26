'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';

const WIDTHS = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

export default function Modal({ open, title, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-overlay/50" onClick={onClose} />
      <div className={`relative flex max-h-[90vh] w-full flex-col rounded-xl bg-surface shadow-pop ${WIDTHS[size]}`}>
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h3 className="text-base font-semibold">{title}</h3>
          <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-surface-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="overflow-y-auto p-5">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-border px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
