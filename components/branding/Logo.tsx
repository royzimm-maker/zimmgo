// Inline SVG recreation of the ZimmGo mark (teal pin + navy plane/swoosh)
// and wordmark (navy "Zimm" + orange "Go") — rebuilt from the provided logo
// reference rather than an exported asset file.

interface LogoMarkProps {
  size?: number;
  className?: string;
  // Swaps the navy elements (swoosh, plane) for white — the navy reads as
  // near-invisible against the dark landing-page background otherwise.
  dark?: boolean;
}

export function LogoMark({ size = 40, className, dark = false }: LogoMarkProps) {
  const accent = dark ? "#ffffff" : "#1b2c4c";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Pin outline */}
      <path
        d="M50 8 C 27 8 10 25 10 47 C 10 68 32 84 50 93 C 68 84 90 68 90 47 C 90 25 73 8 50 8 Z"
        fill="none"
        stroke="#17958c"
        strokeWidth="7"
        strokeLinejoin="round"
      />
      {/* Swoosh sweeping through the lower pin */}
      <path
        d="M22 62 C 40 78 64 76 80 52 C 68 66 42 70 22 62 Z"
        fill={accent}
      />
      {/* Teal "Z" */}
      <text
        x="50"
        y="52"
        textAnchor="middle"
        fontFamily="Poppins, system-ui, sans-serif"
        fontWeight="700"
        fontSize="34"
        fill="#12786f"
      >
        Z
      </text>
      {/* Plane breaking out of the pin, upper right */}
      <g transform="translate(80 18) rotate(-15) scale(1.3) translate(-12 -12)" fill={accent}>
        <path d="M21,16V14L13,9V3.5C13,2.67 12.33,2 11.5,2C10.67,2 10,2.67 10,3.5V9L2,14V16L10,13.5V19L7.5,20.5V22L11.5,21L15.5,22V20.5L13,19V13.5L21,16Z" />
      </g>
    </svg>
  );
}

interface LogoProps {
  size?: number;
  showTagline?: boolean;
  className?: string;
  // For placement on dark backgrounds (e.g. the landing page hero).
  dark?: boolean;
}

export function Logo({ size = 40, showTagline = false, className, dark = false }: LogoProps) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ""}`}>
      <LogoMark size={size} dark={dark} />
      <div className="flex flex-col leading-none">
        <span className="text-2xl font-bold tracking-tight" style={{ lineHeight: 1 }}>
          <span className={dark ? "text-white" : "text-navy-800"}>Zimm</span>
          <span className="text-sunset-500">Go</span>
        </span>
        {showTagline && (
          <span className={`mt-1 text-[9px] font-semibold uppercase tracking-widest ${dark ? "text-slate-300" : "text-navy-700"}`}>
            Adventure made easy.
          </span>
        )}
      </div>
    </div>
  );
}
