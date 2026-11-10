import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

// Les contrôles du socle (apps/web/src/theme/buttons.css) : une pilule, trois tailles, la
// pression à 97 %. `primary` est l'action principale NEUTRE — le dégradé du logo ne sert qu'à
// l'action de lecture (`btn-play`), jamais à un bouton ordinaire.
const variantClasses: Record<Variant, string> = {
  primary: "btn-solid",
  secondary: "btn-soft",
  ghost: "btn-ghost",
  danger: "btn-danger",
};

const sizeClasses: Record<Size, string> = {
  sm: "btn-sm",
  md: "",
  lg: "btn-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", className = "", children, ...props }, ref) => {
    return (
      <button ref={ref} className={`btn ${variantClasses[variant]} ${sizeClasses[size]} ${className}`} {...props}>
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
