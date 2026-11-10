type Variant = "quality" | "status" | "genre";

interface BadgeProps {
  variant?: Variant;
  children: React.ReactNode;
  className?: string;
}

// Les puces du socle (apps/web/src/theme/buttons.css, `.chip`) : 24 px, rayon de 6, sans liseré.
const variantClasses: Record<Variant, string> = {
  quality: "chip-accent",
  status: "",
  genre: "text-content-tertiary",
};

export function Badge({ variant = "status", children, className = "" }: BadgeProps) {
  return <span className={`chip ${variantClasses[variant]} ${className}`}>{children}</span>;
}
