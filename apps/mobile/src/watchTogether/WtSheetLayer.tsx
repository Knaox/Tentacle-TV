import { useCallback, useMemo } from "react";
import { usePathname } from "expo-router";
import { openAffinity, useJellyfinClient, useMediaItem, useWatchTogether } from "@tentacle-tv/api-client";
import { isPlayerPath } from "@tentacle-tv/shared";
import { AffinityModalLayer } from "./affinity/AffinityHost";
import { WtInviteInboxSheet } from "./room/WtInviteInboxSheet";
import { WtInviteSheet } from "./room/WtInviteSheet";
import { WtRoomSheetView } from "./room/WtRoomSheetView";
import { afterWtSheet, closeWtSheet, openWtSheet, useWtSheet } from "./wtSheets";

/**
 * Les feuilles du Watch Together (groupe, « Inviter des membres »,
 * invitations reçues) et l'affinité, montées LÀ OÙ l'écran est visible :
 * par l'hôte à la racine hors du lecteur, par le cadre du lecteur
 * (`WtPlayerFrame`) dedans. Une `Modal` se présente depuis le contrôleur de
 * la vue qui la porte : montée à la racine pendant que le lecteur est
 * présenté en plein écran, iOS refusait de la montrer. Une seule couche
 * montée à la fois — `isPlayerPath` tranche.
 */
export function WtSheetLayer() {
  const wt = useWatchTogether();
  const { room, invites, selfId, actions } = wt;
  const sheet = useWtSheet();
  const pathname = usePathname();
  const client = useJellyfinClient();

  const { data: item } = useMediaItem(room?.itemId ?? undefined, { enabled: !!room?.itemId && sheet === "room" });
  const program = useMemo(() => {
    if (!room?.itemId || !item) return null;
    const title = item.SeriesName ? `${item.SeriesName} — ${item.Name}` : item.Name ?? "";
    return { title, imageUrl: client.getImageUrl(item.Id, item.ImageTags?.Thumb ? "Thumb" : "Primary", { width: 320, quality: 80 }) };
  }, [room?.itemId, item, client]);

  const pendingUserIds = useMemo(() => new Set(wt.pendingInvites.map((p) => p.userId)), [wt.pendingInvites]);
  // Le lecteur se présente en plein écran : seulement une fois la feuille retirée.
  // « Rejoindre » : la salle se gèle au clic et m'attend (`joinPlayback`).
  const onStart = room?.itemId && !isPlayerPath(pathname)
    ? () => { afterWtSheet(() => { void actions.joinPlayback(); }); }
    : undefined;
  // La modale de l'affinité attend d'elle-même le retrait de la feuille (`useGatedModal`).
  const onAffinity = useCallback(() => { closeWtSheet(); openAffinity(); }, []);

  return (
    <>
      {room && (
        <WtRoomSheetView
          visible={sheet === "room"}
          onClose={closeWtSheet}
          room={room}
          selfId={selfId}
          pendingInvites={wt.pendingInvites}
          program={program}
          mayInvite={wt.mayCreate}
          affinityAvailable // seul, le choix du type le dit (« Invitez au moins une personne… »)
          onStart={onStart}
          onInvite={() => openWtSheet("invite")}
          onAffinity={onAffinity}
          onLeave={actions.leave}
          onKick={actions.kick}
        />
      )}
      {room && (
        <WtInviteSheet
          visible={sheet === "invite"}
          onClose={() => openWtSheet("room")}
          room={room}
          pendingUserIds={pendingUserIds}
          onSend={actions.invite}
        />
      )}
      <WtInviteInboxSheet visible={sheet === "inbox"} invites={invites} onClose={closeWtSheet} onRespond={actions.respond} />
      {room && <AffinityModalLayer />}
    </>
  );
}
