import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useToast } from "../contexts/ToastContext";
import { useWatchTogether } from "./WatchTogetherProvider";
import { InviteRow, MemberRow } from "./WatchTogetherRows";

interface WatchTogetherPanelProps {
  onOpenInvite: () => void;
  onClose: () => void;
}

/** Panneau dropdown : invitations reçues, groupe courant (membres, inviter,
 *  quitter, expulser), ou état vide avec création de groupe. */
export function WatchTogetherPanel({ onOpenInvite, onClose }: WatchTogetherPanelProps) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { room, invites, selfId, isHost, actions } = useWatchTogether();
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
          </div>
          <div className="flex items-center gap-2 border-t border-line-subtle p-3">
            {isHost && (
              <button
                onClick={onOpenInvite}
                className="flex-1 rounded-lg bg-cta-primary-bg py-2 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover"
              >
                {t("invite")}
              </button>
            )}
            <button
              onClick={() => run(() => actions.leave(), true)}
              disabled={busy}
              className="flex-1 rounded-lg bg-fill-soft py-2 text-sm font-semibold text-content-secondary transition-colors hover:bg-danger-surface hover:text-status-error-fg disabled:opacity-40"
            >
              {t("leaveGroup")}
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-content-secondary">{t("noGroup")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-content-quaternary">{t("noGroupHint")}</p>
          <button
            onClick={() => run(async () => { await actions.create(); onOpenInvite(); })}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-cta-primary-bg py-2.5 text-sm font-bold text-cta-primary-fg transition-colors duration-150 hover:bg-cta-primary-bg-hover disabled:opacity-40"
          >
            {busy ? t("creating") : t("createGroup")}
          </button>
        </div>
      )}
    </div>
  );
}
