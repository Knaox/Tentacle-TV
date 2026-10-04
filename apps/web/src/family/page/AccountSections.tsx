import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Lock, LockOpen } from "lucide-react";
import { SettingsRow, SettingsSection } from "@tentacle-tv/ui";
import { useDissolveFamily } from "@tentacle-tv/api-client";
import { Modal } from "../../components/ui/Modal";
import { useToast } from "../../contexts/ToastContext";
import { useFamilyText } from "../useFamilyText";
import { OwnPinDialog } from "./PinEditors";
import { SECONDARY_BUTTON, SMALL_BUTTON } from "./familyUi";

/** Mon code PIN : poser, changer, retirer — il protège mon profil sur les TV
 *  de mes familles (et « Gérer les profils » sur celles de la mienne). */
export function MyPinSection({ hasPin }: { hasPin: boolean }) {
  const { t } = useTranslation("familyWeb");
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsSection title={t("myPin.title")} caption={t("myPin.hint")}>
        <SettingsRow
          icon={hasPin ? <Lock size={17} /> : <LockOpen size={17} />}
          label={hasPin ? t("myPin.on") : t("myPin.off")}
          last
          trailing={
            <button type="button" onClick={() => setOpen(true)} className={SMALL_BUTTON}>
              {hasPin ? t("myPin.change") : t("myPin.set")}
            </button>
          }
        />
      </SettingsSection>
      {open && <OwnPinDialog hasPin={hasPin} onClose={() => setOpen(false)} />}
    </>
  );
}

/**
 * Dissoudre ma famille : les membres en sortent, les invités sont supprimés
 * de Jellyfin avec leur lecture. Une case à cocher avant le bouton — le geste
 * est définitif, il ne part pas sur un clic de trop. Le serveur exige de son
 * côté le mot « dissolve » dans le corps.
 */
export function DissolveSection() {
  const { t } = useTranslation("familyWeb");
  const [open, setOpen] = useState(false);
  return (
    <>
      <SettingsSection title={t("danger.title")}>
        <SettingsRow
          label={t("danger.dissolve")}
          description={t("danger.dissolveHint")}
          destructive
          last
          onClick={() => setOpen(true)}
          chevron
        />
      </SettingsSection>
      {open && <DissolveDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function DissolveDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation("familyWeb");
  const { errorText } = useFamilyText();
  const toast = useToast();
  const dissolve = useDissolveFamily();
  const [understood, setUnderstood] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const titleId = useId();
  const descId = useId();
  const checkId = useId();

  const confirm = () => {
    setError(null);
    dissolve.mutate(undefined, {
      onSuccess: () => {
        toast.show("info", t("danger.dissolved"));
        onClose();
      },
      onError: (failure) => setError(errorText(failure)),
    });
  };

  const close = () => {
    if (!dissolve.isPending) onClose();
  };

  return (
    <Modal open onClose={close} maxWidth={440} labelledBy={titleId} describedBy={descId}>
      <div className="p-6">
        <h2 id={titleId} className="text-lg font-bold tracking-tight text-content-primary">{t("confirm.dissolveTitle")}</h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed text-content-tertiary">{t("confirm.dissolveBody")}</p>
        <label htmlFor={checkId} className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-danger-border bg-danger-surface p-3">
          <input
            id={checkId}
            type="checkbox"
            checked={understood}
            onChange={(e) => setUnderstood(e.target.checked)}
            disabled={dissolve.isPending}
            className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[var(--status-error-fg)]"
          />
          <span className="text-sm text-content-primary">{t("confirm.dissolveCheck")}</span>
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-status-error-fg">{error}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={close} disabled={dissolve.isPending} className={SECONDARY_BUTTON}>{t("cancel")}</button>
          <button
            type="button"
            onClick={confirm}
            disabled={!understood || dissolve.isPending}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-danger-border bg-[var(--status-error-bg)] px-4 text-sm font-semibold text-[var(--status-error-fg)] transition hover:bg-danger-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:cursor-not-allowed disabled:opacity-45"
          >
            {t("confirm.dissolveAction")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
