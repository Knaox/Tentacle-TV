import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Lock } from "lucide-react";
import { useUnlockFamilyManage } from "@tentacle-tv/api-client";
import { FAMILY_PIN_LENGTH, isValidPin } from "@tentacle-tv/shared";
import { useFamilyText } from "../useFamilyText";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, FIELD } from "./familyUi";

/**
 * La gestion d'une session de PROFIL, fermée (bureau, 1.30.0) : la fenêtre
 * s'est refermée après dix minutes sans geste, ou le profil s'est rouvert sans
 * son code. SON code la rouvre — le serveur le vérifie seul (mêmes essais,
 * même blocage que partout) ; il ne vit que dans ce champ, jamais dans le
 * stockage ni dans une adresse. La Famille se relit aussitôt.
 */
export function ManageUnlockCard() {
  const { t } = useTranslation(["familyWeb", "family"]);
  const { errorText } = useFamilyText();
  const unlock = useUnlockFamilyManage();
  const [pin, setPin] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const titleId = useId();
  const fieldId = useId();
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidPin(pin)) return setLocalError(t("pin.format"));
    setLocalError(null);
    unlock.mutate({ pin }, { onError: () => setPin("") });
  };

  const shown = localError ?? (unlock.isError ? errorText(unlock.error) : null);
  return (
    <form aria-labelledby={titleId} onSubmit={submit} noValidate className="rounded-xl border border-line-subtle bg-surface-1 p-5">
      <p id={titleId} className="flex items-center gap-2 text-sm font-semibold text-content-primary">
        <Lock size={16} aria-hidden="true" className="text-content-tertiary" />
        {t("manageUnlock.title")}
      </p>
      <p className="mt-1 text-sm leading-relaxed text-content-tertiary">{t("manageUnlock.body")}</p>
      <label htmlFor={fieldId} className="mb-1.5 mt-4 block text-xs font-semibold text-content-secondary">{t("manageUnlock.label")}</label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id={fieldId}
          type="password"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete="off"
          autoFocus
          maxLength={FAMILY_PIN_LENGTH}
          value={pin}
          onChange={(event) => setPin(event.target.value.replace(/[^0-9]/g, "").slice(0, FAMILY_PIN_LENGTH))}
          aria-describedby={shown ? errorId : undefined}
          aria-invalid={shown ? true : undefined}
          disabled={unlock.isPending}
          className={`${FIELD} max-w-[10rem] text-center font-mono text-lg tracking-[0.5em]`}
        />
        <button type="submit" disabled={unlock.isPending} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
          {t("manageUnlock.submit")}
        </button>
      </div>
      {shown && <p id={errorId} role="alert" className="mt-3 text-sm text-status-error-fg">{shown}</p>}
    </form>
  );
}
