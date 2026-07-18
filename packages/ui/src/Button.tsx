import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  // `text-cta-brand-fg` et non `text-content-primary` : le texte est posé sur le
  // dégradé de marque, sa lisibilité dépend de l'accent et non du schéma.
  primary: "text-cta-brand-fg shadow-lg shadow-[rgba(var(--brand-rgb),0.2)]",
  secondary: "bg-fill-soft text-content-primary hover:bg-fill-medium border border-line-subtle",
  ghost: "text-content-secondary hover:bg-fill-soft hover:text-content-primary",
  danger: "bg-danger-surface text-status-error-fg hover:bg-danger-surface-hover border border-danger-border",
};

const variantStyles: Record<Variant, Record<string, string>> = {
  primary: { background: "linear-gradient(135deg, var(--brand), var(--brand-dark))" },
  secondary: {},
  ghost: {},
  danger: {},
};

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs rounded-lg gap-1.5",
  md: "px-5 py-2.5 text-sm rounded-lg gap-2",
  lg: "px-7 py-3 text-base rounded-xl gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", style, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={`inline-flex items-center justify-center font-semibold transition-all duration-200 hover:-translate-y-0.5 disabled:opacity-50 disabled:pointer-events-none ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        style={{ ...variantStyles[variant], ...style }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
