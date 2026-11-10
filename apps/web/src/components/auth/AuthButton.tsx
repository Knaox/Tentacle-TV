import type { ButtonHTMLAttributes, ReactNode } from "react";

interface AuthButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
  /** Requête en cours : anneau, `aria-busy`, bouton désactivé. */
  loading?: boolean;
  /** Libellé pendant la requête (« Connexion… ») ; à défaut, le libellé normal. */
  loadingLabel?: ReactNode;
  fullWidth?: boolean;
}

const VARIANTS = {
  primary: "btn-solid",
  secondary: "btn-soft",
} as const;

/**
 * Le bouton des écrans d'avant connexion. L'ombre violette est POSÉE, jamais
 * animée (une ombre animée repeint à chaque image) ; seul le `transform` du
 * survol bouge.
 */
export function AuthButton({
  variant = "primary",
  loading = false,
  loadingLabel,
  fullWidth = true,
  disabled,
  children,
  className,
  type = "button",
  ...rest
}: AuthButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`btn btn-lg ${fullWidth ? "w-full" : ""} ${VARIANTS[variant]} ${className ?? ""}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent opacity-80"
        />
      )}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
}

/** Lien discret sous la carte ou dans la carte, 44 px de cible. */
export function AuthTextButton({ className, children, type = "button", ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={`btn btn-ghost btn-sm ${className ?? ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
