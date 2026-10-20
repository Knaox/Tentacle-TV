import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Film, Heart, LogOut, UserPlus } from "lucide-react";
import { openAffinity, useJellyfinClient, useMediaItem } from "@tentacle-tv/api-client";
import { roomMemberRows } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { closeRoomModal, showRoomView } from "../../watchTogether/roomModalStore";
import { PrimaryCta, SecondaryCta } from "../screens/misc/shared/PrimaryCta";
import { MirrorWtMemberRow, MirrorWtPendingRow } from "./MirrorWtMemberRow";

/**
 * La feuille du groupe du web étroit — `WtRoomSheetView` du mobile : le
 * groupe, ce qu'il regarde, qui est là (modèle partagé `roomMemberRows`),
 * puis UNE action principale (« Inviter des membres »), l'affinité en
 * secondaire et, séparée, en libellé rouge, « Quitter le groupe » (confirmée).
 * Les gestes sont ceux de la séance partagée (`useWatchTogether().actions`).
 */
export function MirrorWtRoomSheet() {
  const { t } = useTranslation("watchTogether");
  const navigate = useNavigate();
  const client = useJellyfinClient();
  const { room, selfId, pendingInvites, mayCreate, actions } = useWatchTogether();
  const rows = useMemo(() => (room ? roomMemberRows(room, selfId) : []), [room, selfId]);
  const [leaving, setLeaving] = useState(false);
  const { data: item } = useMediaItem(room?.itemId ?? undefined, { enabled: !!room?.itemId });
  if (!room) return null;

  const program = room.itemId && item
    ? {
      title: item.SeriesName ? `${item.SeriesName} — ${item.Name}` : item.Name ?? "",
      imageUrl: client.getImageUrl(item.Id, item.ImageTags?.Thumb ? "Thumb" : "Primary", { width: 320, quality: 80 }),
    }
    : null;
  const onPlayer = window.location.pathname.startsWith("/watch/");

  const leave = () => {
    if (!window.confirm(t("leaveGroup"))) return;
    setLeaving(true);
    actions.leave().then(closeRoomModal, () => setLeaving(false));
  };

  return (
    <div className="px-5 pb-8">
      <h2 className="text-[22px] font-extrabold text-content-primary">{t("yourRoom")}</h2>
      <p className="mt-1 text-[14px] leading-5 text-content-secondary">{t("roomHint")}</p>

      <p className="mb-2 mt-6 text-[12px] font-semibold uppercase tracking-[0.6px] text-content-tertiary">{t("onTheProgram")}</p>
      {program ? (
        <div className="flex items-center gap-3">
          {program.imageUrl
            ? <img src={program.imageUrl} alt="" className="h-[54px] w-24 shrink-0 rounded-lg bg-fill-subtle object-cover" />
            : <span className="flex h-[54px] w-24 shrink-0 items-center justify-center rounded-lg bg-fill-subtle text-content-tertiary"><Film size={22} /></span>}
          <span className="line-clamp-2 min-w-0 flex-1 text-[15px] font-semibold text-content-primary">{program.title}</span>
          {!onPlayer && room.itemId && (
            <button
              type="button"
              onClick={() => { closeRoomModal(); navigate(`/watch/${room.itemId}`); }}
              className="min-h-9 shrink-0 rounded-full border border-line-subtle bg-fill-soft px-3 text-[13px] font-semibold text-content-primary"
            >
              {t("rejoin")}
            </button>
          )}
        </div>
      ) : (
        <p className="text-[14px] text-content-tertiary">{t("roomNoItem")}</p>
      )}

      <p className="mb-1 mt-6 text-[12px] font-semibold uppercase tracking-[0.6px] text-content-tertiary">{t("inTheRoom", { count: room.members.length })}</p>
      {rows.map((row) => <MirrorWtMemberRow key={row.member.userId} row={row} onKick={actions.kick} />)}
      {pendingInvites.map((p) => <MirrorWtPendingRow key={p.userId} userId={p.userId} username={p.username} hasAvatar={p.hasAvatar} />)}
      {rows.length <= 1 && pendingInvites.length === 0 && <p className="text-[14px] text-content-tertiary">{t("roomAlone")}</p>}

      <div className="mt-6 flex flex-col gap-2">
        {mayCreate && (
          <PrimaryCta onPress={() => showRoomView("invite")}>
            <UserPlus size={17} aria-hidden />
            {t("inviteMembers")}
          </PrimaryCta>
        )}
        <SecondaryCta onPress={() => { closeRoomModal(); openAffinity(); }}>
          <Heart size={16} aria-hidden className="mr-1.5" />
          {t("affinityFind")}
        </SecondaryCta>
      </div>
      <div className="my-4 h-px bg-line-subtle" />
      <button
        type="button"
        onClick={leave}
        disabled={leaving}
        className="flex min-h-11 w-full items-center justify-center gap-1.5 text-[15px] font-semibold text-[var(--status-error)] disabled:opacity-45"
      >
        <LogOut size={16} aria-hidden />
        {t("leaveGroup")}
      </button>
    </div>
  );
}
