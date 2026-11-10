import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { EyeIcon as Eye } from "@phosphor-icons/react/dist/csr/Eye";
import { EyeSlashIcon as EyeOff } from "@phosphor-icons/react/dist/csr/EyeSlash";
import type { PluginSetupField } from "@tentacle-tv/shared";
import { cls } from "../../../pages/adminUtils";
import { localized } from "../jellyfin/compatPresentation";

/**
 * Un champ du formulaire `setup` d'une extension : son libellé RELIÉ, son aide
 * et son message d'erreur dans les mots du plugin, et pour un secret le bouton
 * qui l'affiche. Un secret déjà enregistré ne redescend jamais : le champ reste
 * vide, et vide veut dire « garder celui qui est enregistré ».
 */

interface Props {
  field: PluginSetupField;
  value: string;
  storedSecret: boolean;
  error: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function SetupInput({ field, value, storedSecret, error, onChange, disabled }: Props) {
  const { t, i18n } = useTranslation("adminRecommended");
  const id = useId();
  const [revealed, setRevealed] = useState(false);
  const secret = field.kind === "secret";
  const describedBy = [error ? `${id}-error` : null, field.hint ? `${id}-hint` : null].filter(Boolean).join(" ");
  const placeholder = secret && storedSecret ? t("setupKeep") : field.placeholder ?? undefined;

  return (
    <div className="min-w-0">
      {/* Même hauteur avec ou sans « Afficher » : deux champs côte à côte restent alignés. */}
      <div className="flex min-h-[28px] items-end justify-between gap-2">
        <label htmlFor={id} className={cls.lbl}>{localized(field.label, i18n.language)}</label>
        {secret && (
          <button
            type="button"
            onClick={() => setRevealed((shown) => !shown)}
            aria-controls={id}
            aria-pressed={revealed}
            className="btn btn-ghost btn-sm -mr-1 mb-0.5 h-7 px-2 text-xs"
          >
            {revealed ? <EyeOff size={13} weight="bold" aria-hidden="true" /> : <Eye size={13} weight="bold" aria-hidden="true" />}
            {revealed ? t("setupHideSecret") : t("setupShowSecret")}
          </button>
        )}
      </div>
      <input
        id={id}
        type={secret && !revealed ? "password" : field.kind === "url" ? "url" : "text"}
        inputMode={field.kind === "url" ? "url" : undefined}
        // « new-password » : sans lui, le navigateur propose d'y verser le mot de passe de connexion.
        autoComplete={secret ? "new-password" : "off"}
        spellCheck={false}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        aria-required={field.required || undefined}
        aria-describedby={describedBy || undefined}
        className={cls.inp}
      />
      {error && <p id={`${id}-error`} className="mt-1.5 text-xs leading-relaxed text-status-error-fg">{error}</p>}
      {field.hint && (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-content-quaternary">{localized(field.hint, i18n.language)}</p>
      )}
    </div>
  );
}
