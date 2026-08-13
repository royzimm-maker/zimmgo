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
  // The wordmark's "Zimm" is dark navy, baked into the image — on the dark
  // landing-page hero it needs a light chip behind it to stay legible.
  dark?: boolean;
}

export function Logo({ size = 40, showTagline = false, className, dark = false }: LogoProps) {
  // Full lockup's natural aspect ratio (1536x1024) — used to size the
  // wordmark image proportionally to the requested icon size.
  const width = Math.round(size * 3.75);
  const height = size;

  return (
    <div
      className={`inline-flex items-center ${dark ? "rounded-lg bg-white/95 px-2.5 py-1" : ""} ${className ?? ""}`}
    >
      <Image
        src="/logo-full.png"
        alt="ZimmGo — Adventure made easy."
        width={width}
        height={height}
        className={showTagline ? "" : "-mb-1"}
        style={{ objectFit: "contain", height: showTagline ? "auto" : height }}
        priority
      />
    </div>
  );
}
