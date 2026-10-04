import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { FAMILY_PIN_LENGTH, isValidPin } from "@tentacle-tv/shared";
import { Modal } from "../../components/ui/Modal";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, FIELD, SECONDARY_BUTTON } from "./familyUi";

interface PinDialogProps {
  open: boolean;
  title: string;
  pending: boolean;
  /** Le refus du serveur, déjà dit en mots. */
  error: string | null;
  onSubmit: (pin: string) => void;
  /** Le profil a déjà un code : « Retirer le code » s'offre aussi. */
  onRemove?: () => void;
  onClose: () => void;
}

/** Ne garde que des chiffres, quatre au plus (un collage « 12 34 » passe). */
function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, "").slice(0, FAMILY_PIN_LENGTH);
}

/**
 * Poser ou changer un code PIN — le sien, ou celui d'un invité. Deux saisies
 * identiques de quatre chiffres ; le serveur le hache et le vérifie seul (il
 * n'est jamais relu ni gardé ici, ni dans une URL). Champs masqués, clavier
 * numérique, aucune API réservée aux contextes sécurisés : le dialogue marche
 * pareil en HTTP.
 */
export function PinDialog({ open, title, pending, error, onSubmit, onRemove, onClose }: PinDialogProps) {
  const { t } = useTranslation("familyWeb");
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const titleId = useId();
  const pinId = useId();
  const confirmId = useId();
  const hintId = useId();
  const errorId = useId();

  const close = () => {
    setPin("");
    setConfirm("");
    setLocalError(null);
    onClose();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!isValidPin(pin)) return setLocalError(t("pin.format"));
    if (pin !== confirm) return setLocalError(t("pin.mismatch"));
    setLocalError(null);
    onSubmit(pin);
  };

  const shown = localError ?? error;
  const fieldProps = {
    type: "password",
    inputMode: "numeric" as const,
    pattern: "[0-9]*",
    autoComplete: "off",
    maxLength: FAMILY_PIN_LENGTH,
    "aria-describedby": shown ? `${hintId} ${errorId}` : hintId,
    "aria-invalid": shown ? true : undefined,
    className: `${FIELD} max-w-[10rem] text-center font-mono text-lg tracking-[0.5em]`,
    disabled: pending,
  };

  return (
    <Modal open={open} onClose={pending ? () => {} : close} maxWidth={400} labelledBy={titleId}>
      <form className="p-6" onSubmit={submit} noValidate>
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{title}</h2>
        <p id={hintId} className="mt-2 text-sm leading-relaxed text-content-tertiary">
          {t("pin.hint")} {t("pin.effect")}
        </p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor={pinId} className="mb-1.5 block text-xs font-semibold text-content-secondary">{t("pin.label")}</label>
            <input id={pinId} value={pin} onChange={(e) => setPin(digitsOnly(e.target.value))} {...fieldProps} />
          </div>
          <div>
            <label htmlFor={confirmId} className="mb-1.5 block text-xs font-semibold text-content-secondary">{t("pin.confirmLabel")}</label>
            <input id={confirmId} value={confirm} onChange={(e) => setConfirm(digitsOnly(e.target.value))} {...fieldProps} />
          </div>
        </div>
        {shown && (
          <p id={errorId} role="alert" className="mt-4 text-sm text-status-error-fg">{shown}</p>
        )}
        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {onRemove && (
            <button type="button" onClick={onRemove} disabled={pending}
              className="mr-auto rounded-lg px-2 py-2 text-sm font-semibold text-status-error-fg hover:bg-danger-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-45">
              {t("myPin.remove")}
            </button>
          )}
          <button type="button" onClick={close} disabled={pending} className={SECONDARY_BUTTON}>{t("cancel")}</button>
          <button type="submit" disabled={pending} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>{t("pin.save")}</button>
        </div>
      </form>
    </Modal>
  );
}
