import { forwardRef, type InputHTMLAttributes } from "react";

type Size = "sm" | "md";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: Size;
}

const sizeClasses: Record<Size, string> = {
  sm: "px-3 py-2 text-sm",
  md: "px-5 py-3 text-sm",
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ inputSize = "md", className = "", ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={`w-full rounded-lg border border-white/10 bg-white/5 text-white placeholder-white/30 outline-none transition-all focus:ring-2 focus:ring-purple-500/50 focus:border-purple-500/50 ${sizeClasses[inputSize]} ${className}`}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
