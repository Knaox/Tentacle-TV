/**
 * La modale de RÉCEPTION d'une invitation — le pendant de la modale de groupe (`room/WatchTogetherRoomModal`),
 * qui n'en couvre que l'envoi.
 *
 * Une invitation ne produisait jusqu'ici qu'un toast, qui s'efface, et une
 * ligne dans un menu déroulant, qu'il fallait penser à ouvrir. Elle s'ouvre
 * désormais d'elle-même quand on est à l'ACCUEIL — là où l'on ne fait rien de
 * précis, et où être interrompu ne coûte rien. Ailleurs, et surtout en pleine
 * lecture, elle ne s'impose pas : le compteur du logo suffit.
 *
 * Elle ne dessine pas ses lignes : `InviteRow` les rend déjà, et les deux
 * surfaces doivent proposer exactement les mêmes gestes.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { Modal } from "../components/ui/Modal";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";
import { InviteRow } from "./WatchTogetherRows";

interface InviteInboxModalProps {
  onClose: () => void;
}

export function InviteInboxModal({ onClose }: InviteInboxModalProps) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { invites, actions } = useWatchTogether();
  const [busy, setBusy] = useState(false);

  // La dernière invitation honorée referme la modale : il n'y a plus rien à y
  // répondre, et une carte vide au milieu de l'écran ne dit rien.
  if (invites.length === 0) return null;

  const respond = async (inviteId: string, accept: boolean) => {
    setBusy(true);
    try {
      await actions.respond(inviteId, accept);
    } catch {
      show("error", t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  // La feuille commune (`Modal`) dans TOUS les cas : portail, focus piégé, Échap, voile sans flou
  // hors verre natif. La boîte tenait sa propre modale ailleurs — un voile flouté plein écran,
  // ni piège de focus ni Échap.
  return (
    <Modal open onClose={onClose} maxWidth={448} labelledBy="wt-inbox-title" className="flex max-h-[80vh] flex-col">
      <div className="flex items-center justify-between gap-3 px-6 pb-3 pt-5">
        <h2 id="wt-inbox-title" className="font-display text-heading-3 text-content-primary">{t("invitations")}</h2>
        <button type="button" onClick={onClose} aria-label={t("later")} title={t("later")} className="icon-btn -mr-2 h-9 w-9">
          <XIcon className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="divide-y divide-line-subtle overflow-y-auto border-t border-line-subtle py-1">
        {invites.map((invite) => (
          <InviteRow
            key={invite.inviteId}
            invite={invite}
            busy={busy}
            onRespond={(accept) => void respond(invite.inviteId, accept)}
          />
        ))}
      </div>

      <div className="flex justify-end border-t border-line-subtle px-6 py-3">
        <button type="button" onClick={onClose} className="btn btn-sm btn-ghost">
          {t("later")}
        </button>
      </div>
    </Modal>
  );
}
