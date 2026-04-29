import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "info" | "muted";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: "bg-brand-100 text-brand-700",
  success: "bg-green-100 text-green-700",
  warning: "bg-amber-100 text-amber-700",
  info:    "bg-sky-100 text-sky-700",
  muted:   "bg-slate-100 text-slate-600",
};

export function Badge({ variant = "default", className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
        variantClasses[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
