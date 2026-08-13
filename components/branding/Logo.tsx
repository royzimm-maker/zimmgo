import Image from "next/image";

// Real ZimmGo logo assets (exported from ChatGPT, transparent PNGs) —
// /public/logo-mark.png is the pin+plane icon alone, /public/logo-full.png
// is the full lockup (icon + "ZimmGo" wordmark + tagline).

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

export function Logo({ size = 40, showTagline = false, className }: LogoProps) {
  // Full lockup's natural aspect ratio (1536x1024) — used to size the
  // wordmark image proportionally to the requested icon size.
  const width = Math.round(size * 3.75);
  const height = size;

  return (
    <Image
      src="/logo-full.png"
      alt="ZimmGo — Adventure made easy."
      width={width}
      height={height}
      className={`${showTagline ? "" : "-mb-1"} ${className ?? ""}`}
      style={{ objectFit: "contain", height: showTagline ? "auto" : height }}
      priority
    />
  );
}
