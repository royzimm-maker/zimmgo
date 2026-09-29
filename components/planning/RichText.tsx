// RichText: renders the AI's paragraphs, bullet lists, **bold**, and bare
// URLs without a markdown library.
import { ExternalLink } from "lucide-react";

function renderInline(text: string): React.ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/[^\s,)]+)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-slate-800">{part.slice(2, -2)}</strong>;
    }
    if (/^https?:\/\//.test(part)) {
      const display = part.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
      return (
        <a key={i} href={part} target="_blank" rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-brand-500 hover:underline">
          {display}<ExternalLink size={10} className="shrink-0" />
        </a>
      );
    }
    return part;
  });
}

export function RichText({ text, className = "" }: { text: string; className?: string }) {
  if (!text?.trim()) return null;

  // Split into blocks on blank lines
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);

        // Bullet list block: every line starts with - / • / *
        const isList = lines.every((l) => /^[-•*]\s/.test(l));
        if (isList) {
          return (
            <ul key={bi} className="space-y-1 pl-1">
              {lines.map((line, li) => (
                <li key={li} className="flex gap-2 leading-relaxed">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
                  <span>{renderInline(line.replace(/^[-•*]\s/, ""))}</span>
                </li>
              ))}
            </ul>
          );
        }

        // Plain paragraph (preserve intentional single line-breaks)
        return (
          <p key={bi} className="leading-relaxed">
            {lines.map((line, li) => (
              <span key={li}>
                {li > 0 && <br />}
                {renderInline(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
