import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Hourglass, LoaderCircle, UserMinus } from "lucide-react";
import type { WtMemberDto } from "@tentacle-tv/shared";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar, memberStatus } from "../WatchTogetherRows";
import type { WtPendingInvite } from "../usePendingInvites";

/**
 * Les lignes de la salle : un membre (avatar cerclé de son état, rôle, ce
 * qu'il fait), ou une personne invitée qui n'a pas encore répondu — même
 * gabarit, en retrait, un sablier IMMOBILE : une invitation peut attendre des
 * minutes, et rien d'infini ne doit tourner pour elle.
 */

const ROW = "flex min-h-14 items-center gap-3 rounded-xl px-2 py-2";

export const RoomMemberRow = memo(function RoomMemberRow({ member, isSelf, canKick }: {
  member: WtMemberDto;
  isSelf: boolean;
  canKick: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { actions } = useWatchTogether();
  const [kicking, setKicking] = useState(false);
  const status = member.playbackError ? t("cantPlay")
    : member.buffering ? t("bufferingStatus")
    : member.inPlayback ? t("watching")
    : member.online ? t("online") : t("offline");

  const kick = async () => {
    setKicking(true);
    try {
      await actions.kick(member.userId);
    } catch {
      show("error", t("errorGeneric"));
      setKicking(false);
    }
  };

  return (
    <li className={ROW}>
      <WtAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} size={36} status={memberStatus(member)} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium text-content-primary">
          <span className="truncate">{member.username}{isSelf ? ` (${t("you")})` : ""}</span>
          {member.isHost && (
            <span className="shrink-0 rounded-full bg-[rgba(var(--brand-rgb),0.18)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[var(--brand-light)]">
              {t("host")}
            </span>
          )}
        </p>
        <p className="truncate text-xs text-content-tertiary">{status}</p>
      </div>
      {canKick && !isSelf && (
        <button
          type="button"
          onClick={() => void kick()}
          disabled={kicking}
          aria-label={`${t("kick")} — ${member.username}`}
          title={t("kick")}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-content-quaternary outline-none transition-colors hover:bg-danger-surface hover:text-status-error-fg focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
        >
          {kicking ? <LoaderCircle aria-hidden className="h-4 w-4 animate-spin" /> : <UserMinus aria-hidden className="h-4 w-4" />}
        </button>
      )}
    </li>
  );
});

export const PendingInviteRow = memo(function PendingInviteRow({ invite }: { invite: WtPendingInvite }) {
  const { t } = useTranslation("watchTogether");
  return (
    <li className={ROW}>
      <span className="opacity-60">
        <WtAvatar userId={invite.userId} name={invite.username} hasAvatar={invite.hasAvatar} size={36} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-content-secondary">{invite.username}</p>
        <p className="flex items-center gap-1.5 text-xs text-content-tertiary">
          <Hourglass aria-hidden className="h-3 w-3 text-[var(--brand-light)]" />
          {t("invitePending")}
        </p>
      </div>
    </li>
  );
});
