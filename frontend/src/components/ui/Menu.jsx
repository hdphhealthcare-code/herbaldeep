'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';

/**
 * Dropdown menu that is drawn above everything (portal), so it is never clipped by a scrolling table.
 * <Menu trigger={(props) => <button {...props}>...</button>}>{(close) => <><MenuItem .../></>}</Menu>
 */
export default function Menu({ trigger, children, width = 208 }) {
  const btn = useRef(null);
  const panel = useRef(null);
  const [pos, setPos] = useState(null);
  const close = useCallback(() => setPos(null), []);

  useEffect(() => {
    if (!pos) return undefined;
    // scrolling the page closes the menu; scrolling INSIDE the menu (a long list) must not
    const off = (e) => { if (e?.type === 'scroll' && panel.current?.contains(e.target)) return; setPos(null); };
    const esc = (e) => { if (e.key === 'Escape') setPos(null); };
    window.addEventListener('keydown', esc);
    window.addEventListener('scroll', off, true);
    window.addEventListener('resize', off);
    return () => { window.removeEventListener('scroll', off, true); window.removeEventListener('resize', off); window.removeEventListener('keydown', esc); };
  }, [pos]);

  const toggle = (e) => {
    e.stopPropagation();
    if (pos) return close();
    if (!btn.current) return; // trigger must hand its ref to a DOM element (see Pill in OrdersFilters)
    const r = btn.current.getBoundingClientRect();
    const left = Math.min(Math.max(r.right - width, 8), window.innerWidth - width - 8);
    const below = window.innerHeight - r.bottom > 280;
    setPos({ left, ...(below ? { top: r.bottom + 6 } : { bottom: window.innerHeight - r.top + 6 }) });
  };

  return (
    <>
      {trigger({ ref: btn, onClick: toggle, 'aria-haspopup': 'menu', 'aria-expanded': Boolean(pos) })}
      {pos && typeof document !== 'undefined' && createPortal(
        <>
          <div className="fixed inset-0 z-[60]" onClick={(e) => { e.stopPropagation(); close(); }} />
          <div role="menu" ref={panel} style={{ ...pos, width }} className="fixed z-[61] overflow-hidden rounded-xl border border-border bg-surface py-1.5 shadow-pop">
            {typeof children === 'function' ? children(close) : children}
          </div>
        </>,
        document.body
      )}
    </>
  );
}

export function MenuItem({ icon: Icon, children, onClick, href, danger = false, disabled = false, close }) {
  const cls = `flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition ${
    disabled ? 'cursor-not-allowed opacity-40' : danger ? 'text-danger hover:bg-danger-soft' : 'text-foreground hover:bg-surface-muted'}`;
  const inner = (<>{Icon && <Icon className="h-4 w-4 shrink-0 opacity-70" />}{children}</>);
  if (href && !disabled) return <Link role="menuitem" href={href} className={cls} onClick={() => close?.()}>{inner}</Link>;
  return (
    <button role="menuitem" type="button" disabled={disabled} className={cls} onClick={(e) => { e.stopPropagation(); close?.(); onClick?.(e); }}>
      {inner}
    </button>
  );
}

export const MenuLabel = ({ children }) => <p className="eyebrow px-3.5 pb-1 pt-2">{children}</p>;
export const MenuDivider = () => <div className="my-1.5 h-px bg-border" />;
