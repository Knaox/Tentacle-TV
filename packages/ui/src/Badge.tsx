type Variant = "quality" | "status" | "genre";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  quality: "border-[rgba(var(--brand-rgb),0.4)] bg-[rgba(var(--brand-rgb),0.1)] text-[var(--brand-light)] font-semibold",
  status: "border-line-strong bg-fill-soft text-content-secondary",
  genre: "border-transparent bg-fill-subtle text-content-tertiary",
};

export function Badge({ variant = "status", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
