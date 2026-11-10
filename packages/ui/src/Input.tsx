import { forwardRef, type InputHTMLAttributes } from "react";

type Size = "sm" | "md";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: Size;
}

// Le champ du socle (apps/web/src/theme/overlays.css, `.field`) : 40 px, ou 32 en petit.
const sizeClasses: Record<Size, string> = {
  sm: "h-8 text-[13px]",
  md: "",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", className = "", ...props }, ref) => {
    return <input ref={ref} className={`field ${sizeClasses[inputSize]} ${className}`} {...props} />;
  }
);

Input.displayName = "Input";
