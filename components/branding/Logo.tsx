import Image from "next/image";

// Real ZimmGo logo assets (exported from ChatGPT, transparent PNGs) —
// /public/logo-mark.png is the pin+plane icon alone. /public/logo-full.png
// is the original vertically-stacked export (icon + "ZimmGo" wordmark +
// tagline) with the tagline baked in too small to read at UI sizes, so
// /public/logo-lockup.png is a cropped version (icon + wordmark only, 694x496)
// for anywhere the tagline needs to be its own readable text instead.

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 40, className }: LogoMarkProps) {
  return (
    <Image
      src="/logo-mark.png"
      alt="ZimmGo"
      width={size}
      height={size}
      className={className}
      priority
    />
  );
}

interface LogoProps {
  size?: number;
  showTagline?: boolean;
  className?: string;
}

// Icon+wordmark lockup's natural aspect ratio (694x496).
const LOCKUP_ASPECT = 694 / 496;

export function Logo({ size = 40, showTagline = false, className }: LogoProps) {
  const height = size;
  const width = Math.round(size * LOCKUP_ASPECT);

  return (
    <div className={`inline-flex items-center gap-3 ${className ?? ""}`}>
      <Image
        src="/logo-lockup.png"
        alt="ZimmGo"
        width={width}
        height={height}
        style={{ objectFit: "contain", height, width }}
        priority
      />
      {showTagline && (
        <span
          className="whitespace-nowrap font-semibold uppercase tracking-wide text-slate-600"
          style={{ fontSize: Math.max(11, Math.round(size * 0.22)) }}
        >
          Adventure
          <br />
          Made Easy
        </span>
      )}
    </div>
  );
}
