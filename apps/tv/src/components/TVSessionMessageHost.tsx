import { SessionMessagesRedesign, TransientNoticeRedesign } from "../redesignWiring/overlays/noticesRedesign";

/**
 * Les messages que l'administrateur envoie à ce téléviseur — depuis le tableau
 * de bord de Jellyfin (`DisplayMessage`) ou celui de Tentacle. Monté une fois,
 * au-dessus du navigateur : ils arrivent aussi en pleine lecture.
 *
 * La file (délais bornés, deux au plus, effacement toujours seul) :
 * `useSessionMessages` ; le rendu : la refonte (`noticesRedesign`).
 */
export function TVSessionMessageHost() {
  // Les avis brefs de l'app (`showNotice`) passent par le même hôte.
  return (
    <>
      <SessionMessagesRedesign />
      <TransientNoticeRedesign />
    </>
  );
}
