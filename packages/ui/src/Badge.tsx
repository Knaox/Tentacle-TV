type Variant = "quality" | "status" | "genre";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

const variantClasses: Record<Variant, string> = {
  quality: "border-purple-500/40 bg-purple-500/10 text-purple-300 font-semibold",
  status: "border-white/20 bg-white/10 text-white/70",
  genre: "border-transparent bg-white/5 text-white/60",
};

export function Badge({ variant = "status", children, className = "" }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${variantClasses[variant]} ${className}`}>
      {children}
    </span>
  );
}
