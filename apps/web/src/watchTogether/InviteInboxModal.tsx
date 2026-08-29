/**
 * La modale de RÉCEPTION d'une invitation — le pendant d'`InviteUsersModal`,
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
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
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

  // Portal vers <body>, même motif qu'`InviteUsersModal` : rendue depuis le
  // fournisseur, la modale serait sinon piégée par le containing block d'un
  // ancêtre filtré.
  return createPortal(
    <div
      // Voile de modale : reste sombre dans les deux thèmes (standard iOS).
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-line-strong bg-surface-modal shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={t("invitations")}
      >
        <div className="flex items-center justify-between border-b border-line-subtle px-6 py-4">
          <h2 className="text-lg font-bold text-content-primary">{t("invitations")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("later")}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="divide-y divide-line-subtle overflow-y-auto py-1">
          {invites.map((invite) => (
            <InviteRow
              key={invite.inviteId}
              invite={invite}
              busy={busy}
              onRespond={(accept) => void respond(invite.inviteId, accept)}
            />
          ))}
        </div>

        <div className="border-t border-line-subtle px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-medium text-content-tertiary transition-colors hover:text-content-primary"
          >
            {t("later")}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
