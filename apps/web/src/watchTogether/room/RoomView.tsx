import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SignOutIcon as LogOut } from "@phosphor-icons/react/dist/csr/SignOut";
import { PlayIcon as Play } from "../../components/icons/transport";
import { UserPlusIcon as UserPlus } from "@phosphor-icons/react/dist/csr/UserPlus";
import { UsersThreeIcon as UsersRound } from "@phosphor-icons/react/dist/csr/UsersThree";
import { XIcon as X } from "@phosphor-icons/react/dist/csr/X";
import type { WtRoomStateDto } from "@tentacle-tv/shared";
import { useJellyfinClient, useMediaItem } from "@tentacle-tv/api-client";
import { useToast } from "../../contexts/ToastContext";
import { useWatchTogether } from "../WatchTogetherProvider";
import { closeRoomModal, showRoomView } from "../roomModalStore";
import { AffinityEntry } from "../affinity/AffinityEntry";
import { PendingInviteRow, RoomMemberRow } from "./RoomMemberRow";

/**
 * La salle : ce qu'elle a au programme, qui est là, qui est invité — et le
 * geste suivant, inviter (l'hôte) ou lancer la lecture.
 *
 * Sans rien au programme, la salle le dit, et dit comment faire : il suffit
 * de lancer un film ou un épisode, la salle suit.
 */

// La pilule principale du socle (`theme/buttons.css`) : neutre — inviter n'est pas lire.
const PRIMARY = "btn btn-solid";

function ProgramCard({ itemId }: { itemId: string }) {
  const { t } = useTranslation("watchTogether");
  const client = useJellyfinClient();
  const navigate = useNavigate();
  const { data: item } = useMediaItem(itemId);
  const [broken, setBroken] = useState(false);
  const title = item?.SeriesName ?? item?.Name ?? "…";
  const subtitle = item?.SeriesName ? item.Name : item?.ProductionYear ? String(item.ProductionYear) : "";
  return (
    <div className="flex items-center gap-3 rounded-tile bg-surface-2 p-2.5">
      {broken ? (
        <div aria-hidden className="h-[66px] w-11 shrink-0 rounded-chip bg-fill-soft" />
      ) : (
        <img
          src={client.getImageUrl(item?.SeriesId && !item.ImageTags?.Primary ? item.SeriesId : itemId, "Primary", { width: 96, quality: 80 })}
          alt=""
          width={44}
          height={66}
          onError={() => setBroken(true)}
          className="h-[66px] w-11 shrink-0 rounded-chip bg-fill-soft object-cover"
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
        // LA lecture de la salle : le dégradé du logo, la seule action de lecture de la feuille.
        className="btn btn-sm btn-play shrink-0"
      >
        <Play aria-hidden className="h-3.5 w-3.5" />
        {t("startPlayback")}
      </button>
    </div>
  );
}

export function RoomView({ room, fresh, titleId }: { room: WtRoomStateDto; fresh: boolean; titleId: string }) {
  const { t } = useTranslation("watchTogether");
  const { show } = useToast();
  const { selfId, isHost, pendingInvites, actions, mayCreate } = useWatchTogether();
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
        {/* Un médaillon à la teinte franche : plus de dégradé de marque décoratif. */}
        <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-pill bg-accent-soft text-accent">
          <UsersRound weight="fill" className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="font-display text-heading-3 text-content-primary">
            {fresh ? t("roomReady") : t("yourRoom")}
          </h2>
          <p className="mt-0.5 text-[13px] leading-relaxed text-content-tertiary">{t("roomHint")}</p>
        </div>
        <button
          type="button"
          onClick={closeRoomModal}
          aria-label={t("close")}
          title={t("close")}
          className="icon-btn -mr-2 -mt-1 h-9 w-9"
        >
          <X aria-hidden className="h-5 w-5" />
        </button>
      </header>

      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 pb-5">
        <section>
          <h3 className="ui-eyebrow mb-2">{t("onTheProgram")}</h3>
          {room.itemId ? (
            <ProgramCard itemId={room.itemId} />
          ) : (
            <p className="rounded-tile bg-surface-2 px-4 py-3 text-[13px] leading-relaxed text-content-tertiary">
              {t("roomNoItem")}
            </p>
          )}
        </section>

        <section>
          <h3 className="ui-eyebrow mb-1">
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

        <AffinityEntry variant="room" />
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-line-subtle px-6 py-4">
        <button
          type="button"
          onClick={() => void leave()}
          disabled={leaving}
          className="btn btn-ghost -ml-2 px-3 hover:!bg-danger-surface hover:!text-status-error-fg"
        >
          <LogOut aria-hidden className="h-4 w-4" />
          {t("leaveGroup")}
        </button>
        {/* Inviter, c'est « Créer et rejoindre » : un hôte qui l'a perdu garde son salon, sans inviter. */}
        {isHost && mayCreate ? (
          <button type="button" className={PRIMARY} onClick={() => showRoomView("invite")}>
            <UserPlus aria-hidden className="h-4 w-4" />
            {t("inviteMembers")}
          </button>
        ) : (
          <button type="button" className={PRIMARY} onClick={closeRoomModal}>{t("close")}</button>
        )}
      </footer>
    </>
  );
}
