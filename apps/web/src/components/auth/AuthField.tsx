import { forwardRef, useId, useState, type InputHTMLAttributes, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { WarningCircleIcon as AlertCircle } from "@phosphor-icons/react/dist/csr/WarningCircle";
import { EyeIcon as Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
import type { Icon as IconType } from "@phosphor-icons/react";

type NativeInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "id" | "size">;

interface AuthFieldProps extends NativeInputProps {
  label: string;
  /** Pictogramme à gauche du champ — décoratif, le libellé porte le sens. */
  icon?: IconType;
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
      <label htmlFor={fieldId} className="mb-1.5 block text-[13px] font-semibold text-content-secondary">
        {label}
      </label>
      <div className="relative">
        {Icon && (
          <Icon
            aria-hidden
            size={18}
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-content-quaternary"
          />
        )}
        <input
          ref={ref}
          id={fieldId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          // Le champ du socle, en 48 px : on y tape au doigt aussi (16 px sous `sm`, sinon iOS zoome).
          className={`field h-12 text-base sm:text-sm ${Icon ? "pl-11" : "pl-4"} ${trailing ? "pr-12" : "pr-4"} ${className ?? ""}`}
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
          className="icon-btn"
        >
          <Toggle aria-hidden size={18} />
        </button>
      }
    />
  );
});
