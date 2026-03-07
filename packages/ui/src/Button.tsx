import { forwardRef, type ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantClasses: Record<Variant, string> = {
  primary: "text-white shadow-lg shadow-purple-500/20",
  secondary: "bg-white/10 text-white hover:bg-white/15 border border-white/10",
  ghost: "text-white/70 hover:bg-white/10 hover:text-white",
  danger: "bg-red-500/20 text-red-400 hover:bg-red-500/30 border border-red-500/20",
};

const variantStyles: Record<Variant, Record<string, string>> = {
  primary: { background: "linear-gradient(135deg, #8B5CF6, #7C3AED)" },
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
