import { cn } from "@/lib/utils";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  selected?: boolean;
  padding?: "sm" | "md" | "lg" | "none";
}

const paddingClasses = { none: "", sm: "p-3", md: "p-5", lg: "p-6" };

export function Card({
  hover,
  selected,
  padding = "md",
  className,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        "rounded-xl border bg-white shadow-sm transition-all duration-150",
        hover && "cursor-pointer hover:shadow-md hover:border-brand-300",
        selected && "border-brand-500 ring-2 ring-brand-200 shadow-md",
        !selected && "border-slate-200",
        paddingClasses[padding],
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mb-4", className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn("text-lg font-semibold text-slate-900", className)} {...props}>
      {children}
    </h3>
  );
}

export function CardBody({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("text-slate-600 text-sm leading-relaxed", className)} {...props}>
      {children}
    </div>
  );
}
