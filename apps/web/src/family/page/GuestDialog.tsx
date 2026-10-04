import { useId, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { useCreateFamilyGuest } from "@tentacle-tv/api-client";
import {
  FAMILY_GUEST_NAME_MAX,
  FAMILY_PROFILE_COLORS,
  normalizeGuestName,
  type FamilyProfileColor,
} from "@tentacle-tv/shared";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { profileGradient } from "../profileColors";
import { useFamilyText } from "../useFamilyText";
import { BRAND_BUTTON, BRAND_BUTTON_STYLE, FIELD, SECONDARY_BUTTON } from "./familyUi";

/**
 * Créer un profil invité : un prénom et une couleur. Le serveur crée le vrai
 * compte Jellyfin (caché, mot de passe jeté) et la famille au besoin ; le nom
 * est nettoyé ici comme il le sera là-bas (`normalizeGuestName`), pour que
 * l'aperçu dise ce qui sera gardé.
 */
export function GuestDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const create = useCreateFamilyGuest();
  const [name, setName] = useState("");
  const [color, setColor] = useState<FamilyProfileColor>("violet");
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const nameId = useId();
  const hintId = useId();
  const colorLabelId = useId();
  const cleaned = normalizeGuestName(name);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!cleaned) return;
    setError(null);
    create.mutate(
      { name: cleaned, color },
      {
        onSuccess: (profile) => {
          toast.show("success", t("guest.created", { name: profile.name }));
          onClose();
        },
        onError: (failure) => setError(errorText(failure)),
      },
    );
  };

  const close = () => {
    if (!create.isPending) onClose();
  };

  return (
    <Modal open onClose={close} maxWidth={460} labelledBy={titleId}>
      <form className="p-6" onSubmit={submit} noValidate>
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("guest.title")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-content-tertiary">{t("guest.explain")}</p>

        <div className="mt-5 flex items-start gap-4">
          <div
            aria-hidden="true"
            className="mt-6 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full text-xl font-bold text-white"
            style={{ background: profileGradient(color) }}
          >
            {Array.from(cleaned ?? "")[0]?.toUpperCase() ?? "?"}
          </div>
          <div className="min-w-0 flex-1">
            <label htmlFor={nameId} className="mb-1.5 block text-xs font-semibold text-content-secondary">{t("guest.nameLabel")}</label>
            <input
              id={nameId}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("guest.namePlaceholder")}
              maxLength={FAMILY_GUEST_NAME_MAX * 2}
              autoComplete="off"
              aria-describedby={hintId}
              disabled={create.isPending}
              className={FIELD}
            />
            <p id={hintId} className="mt-1.5 text-xs text-content-tertiary">{t("guest.nameHint")}</p>
          </div>
        </div>

        <fieldset className="mt-5">
          <legend id={colorLabelId} className="mb-2 text-xs font-semibold text-content-secondary">{t("guest.colorLabel")}</legend>
          <div role="radiogroup" aria-labelledby={colorLabelId} className="flex flex-wrap gap-2.5">
            {FAMILY_PROFILE_COLORS.map((option) => {
              const selected = option === color;
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(`guest.colors.${option}`)}
                  title={t(`guest.colors.${option}`)}
                  onClick={() => setColor(option)}
                  disabled={create.isPending}
                  className={`flex h-10 w-10 items-center justify-center rounded-full text-white transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-modal)] ${
                    selected ? "scale-110 ring-2 ring-[var(--text-primary)]" : "hover:scale-105"
                  }`}
                  style={{ background: profileGradient(option) }}
                >
                  {selected && <Check size={18} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </fieldset>

        {error && <p role="alert" className="mt-4 text-sm text-status-error-fg">{error}</p>}

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} disabled={create.isPending} className={SECONDARY_BUTTON}>{t("cancel")}</button>
          <button type="submit" disabled={!cleaned || create.isPending} className={BRAND_BUTTON} style={BRAND_BUTTON_STYLE}>
            {t("guest.create")}
          </button>
        </div>
      </form>
    </Modal>
  );
}
