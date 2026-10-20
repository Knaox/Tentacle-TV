import { useEffect, useMemo } from "react";
import { usePathname } from "expo-router";
import { openAffinity, useInboxAutoOpen, useWatchTogether } from "@tentacle-tv/api-client";
import { whenNoModal } from "@/components/ui/modalGate";
import { useStartupOverlaysQuiet } from "@/startup/useStartupOverlay";
import { AffinityHost } from "./affinity/AffinityHost";
import { WtSheetLayer } from "./WtSheetLayer";
import { isPlayerPath } from "@tentacle-tv/shared";
import { closeWtSheet, openWtSheet, takeWtLink, useWtLink, useWtSheet } from "./wtSheets";

/** Un lien profond qui n'a rien à montrer au bout de ce délai est abandonné. */
const LINK_TIMEOUT_MS = 10_000;

/**
 * L'hôte des feuilles du Watch Together mobile, monté une fois par le
 * fournisseur (porte ouverte) : la feuille du groupe, « Inviter des
 * membres », les invitations reçues — une à la fois (`wtSheets`) — et
 * l'affinité de la salle. La boîte des invitations s'ouvre d'elle-même à
 * l'accueil seulement (`useInboxAutoOpen`, la règle du web), après le
 * démarrage, une fois par invitation sur cet appareil, jamais par-dessus une
 * autre modale. Passer d'une feuille à
 * l'autre, à l'affinité ou au lecteur ENCHAÎNE : fermer, attendre le retrait,
 * puis présenter (`afterWtSheet`, `useGatedModal`).
 */
export function WtHost() {
  const wt = useWatchTogether();
  const { room, invites } = wt;
  const sheet = useWtSheet();
  const pathname = usePathname();
  const startupQuiet = useStartupOverlaysQuiet();

  const inviteIds = useMemo(() => invites.map((i) => i.inviteId), [invites]);
  useInboxAutoOpen({ pathname, startupQuiet, inviteIds, enabled: true, open: () => whenNoModal(() => openWtSheet("inbox")) });

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

  // Dans le lecteur, c'est son cadre qui porte les feuilles (`WtPlayerFrame`).
  return (
    <>
      {room && <AffinityHost key={room.groupId} />}
      {!isPlayerPath(pathname) && <WtSheetLayer />}
    </>
  );
}
