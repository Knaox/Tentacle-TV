import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DoorOpen, Hourglass, LogOut, Plus, UserPlus } from "lucide-react";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";
import { InviteRow, MemberRow } from "./WatchTogetherRows";
import { openRoomModal } from "./roomModalStore";

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

const PILL = "inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-full text-[13px] font-semibold outline-none transition-[background-color,transform] duration-150 active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50";
const PRIMARY = `${PILL} border border-cta-primary-border bg-cta-primary-bg font-bold text-cta-primary-fg hover:bg-cta-primary-bg-hover`;
const SECONDARY = `${PILL} border border-line-subtle bg-fill-soft text-content-primary hover:bg-fill-medium`;

export function WatchTogetherPanel({ onClose }: WatchTogetherPanelProps) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { room, invites, selfId, isHost, pendingInvites, actions } = useWatchTogether();
  const [busy, setBusy] = useState(false);

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
      <div className="flex items-center justify-between border-b border-line-subtle px-4 py-3">
        <span className="text-sm font-semibold text-content-primary">{t("title")}</span>
        {room && (
          <span className="text-xs text-content-quaternary">
            {t("membersCount", { count: room.members.length })}
          </span>
        )}
      </div>

      {invites.length > 0 && (
        <div className="border-b border-line-subtle">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-content-quaternary">
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
                <Hourglass aria-hidden className="h-3.5 w-3.5 text-[var(--brand-light)]" />
                {t("pendingInvitesCount", { count: pendingInvites.length })}
              </p>
            )}
          </div>
          <div className="space-y-2 border-t border-line-subtle p-3">
            <div className="flex gap-2">
              {isHost && (
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
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full text-[13px] font-medium text-content-tertiary outline-none transition-colors hover:bg-danger-surface hover:text-status-error-fg focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-40"
            >
              <LogOut aria-hidden className="h-4 w-4" />
              {t("leaveGroup")}
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-content-secondary">{t("noGroup")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-content-quaternary">{t("noGroupHint")}</p>
          <button
            type="button"
            onClick={() => run(async () => {
              await actions.create();
              open("room", true);
            })}
            disabled={busy}
            className={`${PRIMARY} mt-4 w-full`}
          >
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2.4} />
            {busy ? t("creating") : t("createGroup")}
          </button>
        </div>
      )}
    </div>
  );
}
