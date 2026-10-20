import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePathname, useRouter } from "expo-router";
import { openAffinity, useJellyfinClient, useMediaItem, useWatchTogether } from "@tentacle-tv/api-client";
import { whenNoModal } from "@/components/ui/modalGate";
import { useStartupOverlaysQuiet } from "@/startup/useStartupOverlay";
import { AffinityHost } from "./affinity/AffinityHost";
import { WtInviteInboxSheet } from "./room/WtInviteInboxSheet";
import { WtInviteSheet } from "./room/WtInviteSheet";
import { WtRoomSheetView } from "./room/WtRoomSheetView";
import { isPlayerPath, shouldAutoOpenInbox } from "@tentacle-tv/shared";
import { afterWtSheet, closeWtSheet, openWtSheet, takeWtLink, useWtLink, useWtSheet } from "./wtSheets";

/** Un lien profond qui n'a rien à montrer au bout de ce délai est abandonné. */
const LINK_TIMEOUT_MS = 10_000;

/**
 * L'hôte des feuilles du Watch Together mobile, monté une fois par le
 * fournisseur (porte ouverte) : la feuille du groupe, « Inviter des
 * membres », les invitations reçues — une à la fois (`wtSheets`) — et
 * l'affinité de la salle. La boîte des invitations s'ouvre d'elle-même à
 * l'accueil seulement (`shouldAutoOpenInbox`), après le démarrage, une fois
 * par invitation, jamais par-dessus une autre modale. Passer d'une feuille à
 * l'autre, à l'affinité ou au lecteur ENCHAÎNE : fermer, attendre le retrait,
 * puis présenter (`afterWtSheet`, `useGatedModal`).
 */
export function WtHost() {
  const wt = useWatchTogether();
  const { room, invites, selfId, actions } = wt;
  const sheet = useWtSheet();
  const pathname = usePathname();
  const router = useRouter();
  const client = useJellyfinClient();
  const startupQuiet = useStartupOverlaysQuiet();

  const shown = useRef(new Set<string>());
  const inviteIds = useMemo(() => invites.map((i) => i.inviteId), [invites]);
  useEffect(() => {
    if (!shouldAutoOpenInbox({ pathname, startupQuiet, inviteIds, shownIds: shown.current })) return;
    for (const id of inviteIds) shown.current.add(id);
    whenNoModal(() => openWtSheet("inbox"));
  }, [pathname, startupQuiet, inviteIds]);

  // Lien profond : la feuille du groupe (ou les invitations), ou l'affinité.
  const link = useWtLink();
  useEffect(() => {
    if (!link) return;
    if (link === "affinity" && room) { takeWtLink(); openAffinity(); return; }
    if (link === "room" && room) { takeWtLink(); whenNoModal(() => openWtSheet("room")); return; }
    if (link === "room" && invites.length > 0) { takeWtLink(); whenNoModal(() => openWtSheet("inbox")); return; }
    const timer = setTimeout(takeWtLink, LINK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [link, room, invites.length]);

  // La salle disparaît (quittée, dissoute, expulsé) : ses feuilles se ferment ;
  // la dernière invitation honorée referme la boîte (sinon elle se rouvrirait
  // d'elle-même à la prochaine).
  useEffect(() => {
    if (!room && (sheet === "room" || sheet === "invite")) closeWtSheet();
    if (sheet === "inbox" && invites.length === 0) closeWtSheet();
  }, [room, sheet, invites.length]);

  const { data: item } = useMediaItem(room?.itemId ?? undefined, { enabled: !!room?.itemId && sheet === "room" });
  const program = useMemo(() => {
    if (!room?.itemId || !item) return null;
    const title = item.SeriesName ? `${item.SeriesName} — ${item.Name}` : item.Name ?? "";
    return { title, imageUrl: client.getImageUrl(item.Id, item.ImageTags?.Thumb ? "Thumb" : "Primary", { width: 320, quality: 80 }) };
  }, [room?.itemId, item, client]);

  const pendingUserIds = useMemo(() => new Set(wt.pendingInvites.map((p) => p.userId)), [wt.pendingInvites]);
  const onStart = room?.itemId && !isPlayerPath(pathname)
    ? () => { const id = room.itemId; afterWtSheet(() => router.push(`/watch/${id}`)); }
    : undefined;
  // La modale de l'affinité attend d'elle-même le retrait de la feuille.
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
      {room && <AffinityHost key={room.groupId} />}
    </>
  );
}
