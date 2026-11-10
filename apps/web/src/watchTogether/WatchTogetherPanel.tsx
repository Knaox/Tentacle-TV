import { useState } from "react";
import { useTranslation } from "react-i18next";
import { elsewhereLabel } from "@tentacle-tv/shared";
import { DoorOpenIcon as DoorOpen } from "@phosphor-icons/react/dist/csr/DoorOpen";
import { HourglassIcon as Hourglass } from "@phosphor-icons/react/dist/csr/Hourglass";
import { SignOutIcon as LogOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { PlusIcon as Plus } from "@phosphor-icons/react/dist/csr/Plus";
import { UserPlusIcon as UserPlus } from "@phosphor-icons/react/dist/csr/UserPlus";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";
import { InviteRow, MemberRow } from "./WatchTogetherRows";
import { openRoomModal } from "./roomModalStore";
import { AffinityEntry } from "./affinity/AffinityEntry";

interface WatchTogetherPanelProps {
  onClose: () => void;
}

/**
 * Panneau déroulant de la barre : invitations reçues, salle courante
 * (membres, invitations en attente, inviter, ouvrir la salle, quitter), ou
 * l'état vide avec la création d'une salle.
 *
 * Créer une salle n'ouvre PLUS d'office le choix des invités : on arrive sur
 * la salle (`WatchTogetherRoomModal`), d'où l'on invite une ou plusieurs
 * personnes quand on le décide.
 */

// Les pilules du socle (`theme/buttons.css`) : l'action principale neutre, la secondaire douce.
const PRIMARY = "btn btn-solid flex-1";
const SECONDARY = "btn btn-soft flex-1";

export function WatchTogetherPanel({ onClose }: WatchTogetherPanelProps) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { room, invites, selfId, isHost, pendingInvites, actions, mayCreate, elsewhere } = useWatchTogether();
  const [busy, setBusy] = useState(false);
  // « Votre groupe… » quand l'hôte est ce compte, sinon « Groupe de X… » (règle partagée).
  const said = elsewhere ? elsewhereLabel(elsewhere, selfId) : null;
  const elsewhereText = !said ? "" : "params" in said ? t(said.key, said.params) : t(said.key);

  const run = async (fn: () => Promise<unknown>, closeAfter = false) => {
    setBusy(true);
    try {
      await fn();
      if (closeAfter) onClose();
    } catch {
      show("error", t("errorGeneric"));
    } finally {
      setBusy(false);
    }
  };

  const open = (view: "room" | "invite", fresh = false) => {
    onClose();
    openRoomModal(view, { fresh });
  };

  return (
    <div>
      <div className="lg-sep flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <span className="font-display text-[15px] font-semibold tracking-tight text-content-primary">{t("title")}</span>
        {room && (
          <span className="text-xs text-content-quaternary">
            {t("membersCount", { count: room.members.length })}
          </span>
        )}
      </div>

      {invites.length > 0 && (
        <div className="lg-sep border-b border-line-subtle">
          <p className="lg-menu-label ui-eyebrow px-4 pt-3">
            {t("invitations")}
          </p>
          {invites.map((invite) => (
            <InviteRow
              key={invite.inviteId}
              invite={invite}
              busy={busy}
              onRespond={(accept) => run(() => actions.respond(invite.inviteId, accept), accept)}
            />
          ))}
        </div>
      )}

      {room ? (
        <>
          <div className="max-h-72 overflow-y-auto py-1">
            {room.members.map((member) => (
              <MemberRow
                key={member.userId}
                member={member}
                isSelf={member.userId === selfId}
                canKick={isHost}
                onKick={() => run(() => actions.kick(member.userId))}
              />
            ))}
            {pendingInvites.length > 0 && (
              <p className="flex items-center gap-2 px-4 py-2 text-xs text-content-tertiary">
                <Hourglass aria-hidden className="h-3.5 w-3.5 text-content-tertiary" />
                {t("pendingInvitesCount", { count: pendingInvites.length })}
              </p>
            )}
          </div>
          <div className="lg-sep space-y-2 border-t border-line-subtle p-3">
            <AffinityEntry variant="panel" onOpen={onClose} />
            <div className="flex gap-2">
              {isHost && mayCreate && (
                <button type="button" onClick={() => open("invite")} className={PRIMARY}>
                  <UserPlus aria-hidden className="h-4 w-4" />
                  {t("invite")}
                </button>
              )}
              <button type="button" onClick={() => open("room")} className={SECONDARY}>
                <DoorOpen aria-hidden className="h-4 w-4" />
                {t("openRoom")}
              </button>
            </div>
            <button
              type="button"
              onClick={() => run(() => actions.leave(), true)}
              disabled={busy}
              className="btn btn-sm btn-ghost w-full hover:!bg-danger-surface hover:!text-status-error-fg"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t("leaveGroup")}
            </button>
          </div>
        </>
      ) : elsewhere ? (
        // Le compte est en groupe sur un AUTRE appareil : on n'en crée pas un
        // second (le serveur le refuserait), on propose d'ajouter celui-ci.
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-content-secondary">
            {elsewhereText}
          </p>
          <button
            type="button"
            onClick={() => run(() => actions.joinHere(), true)}
            disabled={busy}
            className={`${PRIMARY} mt-4 w-full`}
          >
            <DoorOpen aria-hidden className="h-4 w-4" />
            {t("elsewhereJoinHere")}
          </button>
        </div>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-content-secondary">{t("noGroup")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-content-quaternary">{t(mayCreate ? "noGroupHint" : "joinOnlyHint")}</p>
          {mayCreate && <button
            type="button"
            onClick={() => run(async () => {
              await actions.create();
              open("room", true);
            })}
            disabled={busy}
            className={`${PRIMARY} mt-4 w-full`}
          >
            <Plus weight="bold" aria-hidden className="h-4 w-4" />
            {busy ? t("creating") : t("createGroup")}
          </button>}
        </div>
      )}
    </div>
  );
}
