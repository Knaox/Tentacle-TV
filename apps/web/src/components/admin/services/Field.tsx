import { useId, type InputHTMLAttributes, type ReactNode } from "react";
import { cls } from "../../../pages/adminUtils";

/**
 * Un champ de la page « Services » : son libellé RELIÉ au champ (les anciens
 * ne l'étaient pas — un clic sur le libellé ne menait nulle part, et un
 * lecteur d'écran annonçait des champs sans nom), son aide, et son message.
 *
 * `error` bloque l'enregistrement et borde le champ de rouge ; `warning`
 * prévient sans bloquer (contenu mixte, par exemple).
 */

interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "className"> {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  warning?: string | null;
  className?: string;
}

export function Field({ label, hint, error, warning, className = "", id, ...input }: FieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const message = error || warning;
  const describedBy = [hint ? `${inputId}-hint` : null, message ? `${inputId}-message` : null].filter(Boolean).join(" ");
  return (
    <div className={`min-w-0 ${className}`}>
      <label htmlFor={inputId} className={cls.lbl}>{label}</label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        // Variante `aria-[invalid=true]` : elle passe après la bordure de base
        // ET après celle du focus — un champ faux reste rouge sous le curseur.
        className={`${cls.inp} aria-[invalid=true]:border-status-error`}
        {...input}
      />
      {message && (
        <p id={`${inputId}-message`} className={`mt-1.5 text-xs leading-relaxed ${error ? "text-status-error-fg" : "text-status-warning-fg"}`}>
          {message}
        </p>
      )}
      {hint && <p id={`${inputId}-hint`} className="mt-1.5 text-xs leading-relaxed text-content-quaternary">{hint}</p>}
    </div>
  );
}
