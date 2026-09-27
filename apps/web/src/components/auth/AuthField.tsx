import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle, Eye, EyeOff, type LucideIcon } from "lucide-react";

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "size">;

interface AuthFieldProps extends NativeInputProps {
  label: string;
  /** Pictogramme à gauche du champ — décoratif, le libellé porte le sens. */
  icon?: LucideIcon;
  /** Aide persistante sous le champ. */
  hint?: ReactNode;
  /** Erreur propre au champ : bordure, `aria-invalid` et message relié. */
  error?: ReactNode;
  /** Élément à droite, DANS le champ (bouton afficher le mot de passe). */
  trailing?: ReactNode;
  id?: string;
}

/**
 * Le champ des écrans d'avant connexion : libellé TOUJOURS visible (jamais le
 * seul placeholder), aide et erreur reliées par `aria-describedby`, 48 px de
 * haut, et 16 px de texte sous `sm` — en dessous, Safari iOS zoome au focus.
 */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, icon: Icon, hint, error, trailing, id, className, ...input },
  ref,
) {
  const autoId = useId();
  const fieldId = id ?? `auth-${autoId}`;
  const hintId = hint ? `${fieldId}-hint` : undefined;
  const errorId = error ? `${fieldId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-medium text-content-secondary">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden
            size={18}
            strokeWidth={1.75}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-quaternary"
          />
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`h-12 w-full rounded-xl border bg-fill-subtle text-base text-content-primary outline-none transition-colors placeholder:text-content-quaternary focus:ring-2 sm:text-sm ${
            Icon ? "pl-11" : "pl-4"
          } ${trailing ? "pr-12" : "pr-4"} ${
            error
              ? "border-status-error focus:border-status-error focus:ring-danger-border"
              : "border-line-subtle hover:border-line-strong focus:border-[var(--brand)] focus:ring-[rgba(var(--brand-rgb),0.3)]"
          } ${className ?? ""}`}
          {...input}
        />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 flex items-start gap-1.5 text-[13px] text-status-error-fg">
          <AlertCircle aria-hidden size={15} className="mt-px shrink-0" />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className="mt-1.5 text-xs leading-relaxed text-content-tertiary">
          {hint}
        </p>
      )}
    </div>
  );
});

type PasswordFieldProps = Omit<AuthFieldProps, "type" | "trailing">;

/** Le mot de passe, avec son bouton afficher / masquer (44 px de cible). */
export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(props, ref) {
  const { t } = useTranslation("auth");
  const [visible, setVisible] = useState(false);
  const Toggle = visible ? EyeOff : Eye;

  return (
    <AuthField
      ref={ref}
      {...props}
      type={visible ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? t("hidePassword") : t("showPassword")}
          aria-pressed={visible}
          aria-controls={props.id}
          className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-content-tertiary transition-colors hover:text-content-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          <Toggle aria-hidden size={18} strokeWidth={1.75} />
        </button>
      }
    />
  );
});
