import { useMemo } from "react";
import { EXPIRED_BANNER_BOTTOM, ExpiredPairingBanner } from "../../redesign/screens/overlays/ExpiredPairingBanner";
import { NoticeToast } from "../../redesign/screens/overlays/NoticeToast";
import { SessionMessages, type SessionMessageModel } from "../../redesign/screens/overlays/SessionMessages";
import { usePairingExpired } from "../../hooks/usePairingExpired";
import { useSessionMessages } from "../../hooks/useSessionMessages";
import { useTransientNotice } from "./transientNotice";

/**
 * Les surimpressions qui informent sans jamais prendre le focus (Apple TV) :
 * le bandeau « jumelage expiré », les messages de l'administrateur — logique
 * commune aux deux téléviseurs (`usePairingExpired`, `useSessionMessages`) —
 * et les avis brefs de l'app (`showNotice`). Ici, le rendu de la refonte.
 */

export function ExpiredPairingRedesign() {
  return usePairingExpired() ? <ExpiredPairingBanner /> : null;
}

/** L'écart entre le bandeau et les messages posés dessous. */
const STACK_GAP = 18;

export function SessionMessagesRedesign() {
  const messages = useSessionMessages();
  // Le bandeau « jumelage expiré » occupe le haut, au centre : les messages
  // passent dessous plutôt que de le couvrir (même requête, rien de plus).
  const expired = usePairingExpired();
  // Chaque message part plein (`remaining` 1) et sa barre se vide sur son
  // délai ; la file le retire à l'échéance.
  const models = useMemo<SessionMessageModel[]>(
    () => messages.map((message) => ({
      id: message.id,
      header: message.header,
      text: message.text,
      remaining: 1,
      durationMs: message.durationMs,
    })),
    [messages],
  );
  return <SessionMessages messages={models} top={expired ? EXPIRED_BANNER_BOTTOM + STACK_GAP : undefined} />;
}

/** L'avis bref du moment (`showNotice`) — sous le bandeau du jumelage expiré s'il est là. */
export function TransientNoticeRedesign() {
  const notice = useTransientNotice();
  const expired = usePairingExpired();
  return <NoticeToast notice={notice} top={expired ? EXPIRED_BANNER_BOTTOM + STACK_GAP : undefined} />;
}
