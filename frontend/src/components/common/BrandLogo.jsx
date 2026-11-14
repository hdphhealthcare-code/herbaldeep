/* eslint-disable @next/next/no-img-element */
import { BRAND } from '@/lib/brand';

// Logo + name. `compact` shows the logo only (collapsed sidebar).
export default function BrandLogo({ compact = false, dark = false, size = 36 }) {
  return (
    <span className="flex items-center gap-3">
      <img src={BRAND.logo} alt={BRAND.name} width={size} height={size} className="shrink-0 rounded-xl" />
      {!compact && (
        <span className="leading-tight">
          <span className={`block text-[15px] font-semibold tracking-tight ${dark ? 'text-white' : 'text-foreground'}`}>{BRAND.name}</span>
          <span className={`block text-[11px] ${dark ? 'text-white/50' : 'text-muted'}`}>{BRAND.tagline}</span>
        </span>
      )}
    </span>
  );
}
