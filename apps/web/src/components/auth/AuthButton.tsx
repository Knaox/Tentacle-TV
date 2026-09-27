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
  primary:
    "bg-cta-primary-bg text-cta-primary-fg font-bold shadow-[0_8px_24px_-8px_rgba(var(--brand-rgb),0.55)] hover:bg-cta-primary-bg-hover",
  secondary:
    "border border-line-subtle bg-fill-subtle text-content-primary font-semibold hover:border-line-strong hover:bg-fill-soft",
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
      className={`inline-flex h-12 cursor-pointer items-center justify-center gap-2.5 rounded-xl px-5 text-sm transition-[transform,background-color,border-color] duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:translate-y-0 ${
        fullWidth ? "w-full" : ""
      } ${VARIANTS[variant]} ${className ?? ""}`}
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
      className={`inline-flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-medium text-content-tertiary transition-colors hover:text-[var(--brand-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] ${className ?? ""}`}
      {...rest}
    >
      {children}
    </button>
  );
}
