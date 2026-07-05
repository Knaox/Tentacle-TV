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
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <span className="text-sm font-semibold text-white">{t("title")}</span>
        {room && (
          <span className="text-xs text-white/40">
            {t("membersCount", { count: room.members.length })}
          </span>
        )}
      </div>

      {invites.length > 0 && (
        <div className="border-b border-white/10">
          <p className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-white/40">
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
          <div className="flex items-center gap-2 border-t border-white/10 p-3">
            {isHost && (
              <button
                onClick={onOpenInvite}
                className="flex-1 rounded-lg bg-white py-2 text-sm font-bold text-black transition-colors duration-150 hover:bg-white/85"
              >
                {t("invite")}
              </button>
            )}
            <button
              onClick={() => run(() => actions.leave(), true)}
              disabled={busy}
              className="flex-1 rounded-lg bg-white/10 py-2 text-sm font-semibold text-white/70 transition-colors hover:bg-red-500/15 hover:text-red-300 disabled:opacity-40"
            >
              {t("leaveGroup")}
            </button>
          </div>
        </>
      ) : (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-white/70">{t("noGroup")}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-white/40">{t("noGroupHint")}</p>
          <button
            onClick={() => run(async () => { await actions.create(); onOpenInvite(); })}
            disabled={busy}
            className="mt-4 w-full rounded-lg bg-white py-2.5 text-sm font-bold text-black transition-colors duration-150 hover:bg-white/85 disabled:opacity-40"
          >
            {busy ? t("creating") : t("createGroup")}
          </button>
        </div>
      )}
    </div>
  );
}
