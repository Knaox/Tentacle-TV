import { useId } from "react";
import { Modal } from "../../components/ui/Modal";
import { useWatchTogether } from "../WatchTogetherProvider";
import { AffinityDeckView } from "./AffinityDeckView";
import { AffinityKindsView } from "./AffinityKindsView";
import { AffinityMatchView } from "./AffinityMatchView";
import { AffinityMatchesView } from "./AffinityMatchesView";
import { closeAffinity, useAffinityStore } from "./affinityStore";

/**
 * La modale de l'affinité — une seule, montée par `AffinityRoot`. Ses vues :
 * le choix du type, la pile, le match qui vient de tomber, la liste des
 * matchs. Sans séance, il n'y a que le choix du type.
 *
 * Pour un participant, la pile reste MONTÉE sous le match et la liste (cachée,
 * sans clavier) : revenir à la pile ne recharge rien et l'annulation du
 * dernier geste tient toujours.
 */
export function AffinityModal() {
  const { modal, state } = useAffinityStore();
  const { selfId } = useWatchTogether();
  const deckTitleId = useId();
  const viewTitleId = useId();
  if (!modal.open) return null;

  const view = state ? modal.view : "kinds";
  const participant = !!state && state.participants.some((p) => p.userId === selfId);
  const overlay = view === "match" || view === "matches";
  const deckMounted = !!state && (view === "deck" || (overlay && participant));

  return (
    <Modal
      open
      onClose={closeAffinity}
      labelledBy={view === "deck" ? deckTitleId : viewTitleId}
      maxWidth={deckMounted ? 540 : 480}
      // Un glisser de carte qui se relâche hors du panneau produit un clic
      // sur le voile (ancêtre commun de l'appui et du relâcher) : la pile se
      // refermait à chaque swipe appuyé — sur téléphone, presque toujours.
      // La croix et Échap ferment.
      dismissOnBackdrop={!deckMounted}
    >
      <div className="flex flex-col" style={{ maxHeight: "94dvh" }}>
        {deckMounted && state && (
          <div className={overlay ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
            <AffinityDeckView key={state.sessionId} state={state} titleId={deckTitleId} paused={overlay} />
          </div>
        )}
        {view === "kinds" && <AffinityKindsView state={state} titleId={viewTitleId} />}
        {view === "match" && state && modal.matchKey && (
          <AffinityMatchView state={state} matchKey={modal.matchKey} returnTo={modal.returnTo} titleId={viewTitleId} />
        )}
        {view === "matches" && state && <AffinityMatchesView state={state} titleId={viewTitleId} />}
      </div>
    </Modal>
  );
}
