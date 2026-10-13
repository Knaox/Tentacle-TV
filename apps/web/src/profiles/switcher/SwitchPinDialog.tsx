import { memo, useId } from "react";
import { useTranslation } from "react-i18next";
import { Modal } from "../../components/ui/Modal";
import { ProfilePinPad } from "../picker/ProfilePinPad";
import type { PinPadModel } from "../picker/pickerTypes";

interface SwitchPinDialogProps {
  pad: PinPadModel;
  onDigit: (digit: string) => void;
  onErase: () => void;
  /** Annuler, Échap, ou un clic hors du dialogue : on reste sur le profil actuel. */
  onClose: () => void;
}

/**
 * Le code PIN d'un profil choisi dans le menu de l'avatar : le même pavé que
 * « Qui regarde ? », dans un dialogue (focus piégé, Échap ferme — `Modal`).
 * Le pavé se tait pendant la vérification ; le dialogue ne se ferme pas tant
 * que le serveur n'a pas répondu.
 */
export const SwitchPinDialog = memo(function SwitchPinDialog({ pad, onDigit, onErase, onClose }: SwitchPinDialogProps) {
  const { t } = useTranslation("profilePicker");
  const titleId = useId();
  const checking = pad.phase === "checking";
  const close = checking ? () => {} : onClose;
  return (
    <Modal open onClose={close} maxWidth={380} labelledBy={titleId}>
      <div className="px-6 pb-6 pt-7">
        <span id={titleId} className="sr-only">{t("pin.title", { name: pad.profile.name })}</span>
        <ProfilePinPad pad={pad} onDigit={onDigit} onErase={onErase} onBack={close} compact />
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={close}
            disabled={checking}
            className="inline-flex h-10 items-center justify-center rounded-full border border-line-subtle bg-fill-soft px-5 text-sm font-semibold text-content-primary transition-colors hover:bg-fill-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-45"
          >
            {t("pin.cancel")}
          </button>
        </div>
      </div>
    </Modal>
  );
});
