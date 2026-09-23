import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { LogOut, Play, UserPlus, UsersRound, X } from "lucide-react";
import type { WtRoomStateDto } from "@tentacle-tv/shared";
import { useJellyfinClient, useMediaItem } from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { closeRoomModal, showRoomView } from "../roomModalStore";
import { PendingInviteRow, RoomMemberRow } from "./RoomMemberRow";

/**
 * La salle : ce qu'elle a au programme, qui est là, qui est invité — et le
 * geste suivant, inviter (l'hôte) ou lancer la lecture.
 *
 * Sans rien au programme, la salle le dit, et dit comment faire : il suffit
 * de lancer un film ou un épisode, la salle suit.
 */

const PRIMARY =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full border border-cta-primary-border bg-cta-primary-bg px-5 text-sm font-bold text-cta-primary-fg outline-none transition-[background-color,transform] duration-150 hover:bg-cta-primary-bg-hover active:scale-[0.97] focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50";

function ProgramCard({ itemId }: { itemId: string }) {
  const { t } = useTranslation("watchTogether");
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const { data: item } = useMediaItem(itemId);
  const [broken, setBroken] = useState(false);
  const title = item?.SeriesName ?? item?.Name ?? "…";
  const subtitle = item?.SeriesName ? item.Name : item?.ProductionYear ? String(item.ProductionYear) : "";
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line-subtle bg-fill-faint p-2.5">
      {broken ? (
        <div aria-hidden className="h-[66px] w-11 shrink-0 rounded-lg bg-fill-soft" />
      ) : (
        <img
          src={client.getImageUrl(item?.SeriesId && !item.ImageTags?.Primary ? item.SeriesId : itemId, "Primary", { width: 96, quality: 80 })}
          alt=""
          width={44}
          height={66}
          onError={() => setBroken(true)}
          className="h-[66px] w-11 shrink-0 rounded-lg bg-fill-soft object-cover"
        />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-content-primary">{title}</p>
        {subtitle && <p className="truncate text-xs text-content-tertiary">{subtitle}</p>}
      </div>
      <button
        type="button"
        onClick={() => {
          closeRoomModal();
          navigate(`/watch/${itemId}`);
        }}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[rgba(var(--brand-rgb),0.18)] px-3.5 text-[13px] font-semibold text-content-primary outline-none transition-colors hover:bg-[rgba(var(--brand-rgb),0.3)] focus-visible:ring-2 focus-visible:ring-line-focus"
      >
        <Play aria-hidden className="h-3.5 w-3.5" fill="currentColor" />
        {t("startPlayback")}
      </button>
    </div>
  );
}

export function RoomView({ room, fresh, titleId }: { room: WtRoomStateDto; fresh: boolean; titleId: string }) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { selfId, isHost, pendingInvites, actions } = useWatchTogether();
  const [leaving, setLeaving] = useState(false);

  const leave = async () => {
    setLeaving(true);
    try {
      await actions.leave();
      closeRoomModal();
    } catch {
      show("error", t("errorGeneric"));
      setLeaving(false);
    }
  };

  return (
    <>
      <header className="flex items-start gap-3 px-6 pb-4 pt-6">
        <span
          aria-hidden
          className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white"
          style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
        >
          <UsersRound className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-semibold tracking-tight text-content-primary">
            {fresh ? t("roomReady") : t("yourRoom")}
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-content-tertiary">{t("roomHint")}</p>
        </div>
        <button
          type="button"
          onClick={closeRoomModal}
          aria-label={t("close")}
          className="-mr-2 -mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
        <section>
          <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">{t("onTheProgram")}</h3>
          {room.itemId ? (
            <ProgramCard itemId={room.itemId} />
          ) : (
            <p className="rounded-2xl border border-dashed border-line-subtle px-4 py-3 text-[13px] leading-relaxed text-content-tertiary">
              {t("roomNoItem")}
            </p>
          )}
        </section>

        <section>
          <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-content-quaternary">
            {t("inTheRoom", { count: room.members.length })}
          </h3>
          <ul className="-mx-2">
            {room.members.map((member) => (
              <RoomMemberRow key={member.userId} member={member} isSelf={member.userId === selfId} canKick={isHost} />
            ))}
            {pendingInvites.map((invite) => <PendingInviteRow key={invite.userId} invite={invite} />)}
          </ul>
          {isHost && room.members.length === 1 && pendingInvites.length === 0 && (
            <p className="mt-2 text-[13px] text-content-tertiary">{t("roomAlone")}</p>
          )}
        </section>
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-6 py-4">
        <button
          type="button"
          onClick={() => void leave()}
          disabled={leaving}
          className="inline-flex h-10 items-center gap-2 rounded-full px-3 text-[13px] font-medium text-content-tertiary outline-none transition-colors hover:bg-danger-surface hover:text-status-error-fg focus-visible:ring-2 focus-visible:ring-line-focus disabled:opacity-50"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {t("leaveGroup")}
        </button>
        {isHost ? (
          <button type="button" className={PRIMARY} onClick={() => showRoomView("invite")}>
            <UserPlus aria-hidden className="h-4 w-4" strokeWidth={2.2} />
            {t("inviteMembers")}
          </button>
        ) : (
          <button type="button" className={PRIMARY} onClick={closeRoomModal}>{t("close")}</button>
        )}
      </footer>
    </>
  );
}
