import { useCallback, useId } from "react";
import { leaveAffinity } from "@tentacle-tv/api-client";
import { Modal } from "../../components/ui/Modal";
import { useWatchTogether } from "../WatchTogetherProvider";
import { AffinityDeckView } from "./AffinityDeckView";
import { AffinityKindsView } from "./AffinityKindsView";
import { AffinityMatchView } from "./AffinityMatchView";
import { closeAffinity, getAffinitySnapshot, useAffinityStore } from "./affinityStore";

/**
 * La modale de l'affinité — une seule, montée par `AffinityRoot`. Ses vues :
 * le choix du type, la pile, et le match — qui ne se choisit pas : le
 * premier match en attente (`proposals`) s'affiche chez tous les
 * participants à la fois, et disparaît chez tous quand quelqu'un y répond.
 *
 * Sous le match, la pile reste MONTÉE (cachée, sans clavier) : quand elle
 * reprend, rien ne se recharge et l'annulation du dernier geste tient.
 *
 * Fermer la modale — la croix, Échap —, c'est QUITTER l'affinité : à deux,
 * elle se referme aussi chez l'autre. Sans séance, c'est seulement fermer.
 */
export function AffinityModal({ onStale }: { onStale: () => void }) {
  const { modal, state } = useAffinityStore();
  const { selfId } = useWatchTogether();
  const deckTitleId = useId();
  const viewTitleId = useId();
  const quit = useCallback(() => {
    if (getAffinitySnapshot().state) void leaveAffinity().catch(() => undefined);
    closeAffinity();
  }, []);
  if (!modal.open) return null;

  const participant = !!state && state.participants.some((p) => p.userId === selfId);
  const proposal = participant ? (state.proposals[0] ?? null) : null;
  const view = !state ? "kinds" : proposal ? "match" : modal.view;
  const deckMounted = !!state && view !== "kinds";

  return (
    <Modal
      open
      onClose={quit}
      labelledBy={view === "deck" ? deckTitleId : viewTitleId}
      maxWidth={deckMounted ? 540 : 480}
      // Un glisser de carte qui se relâche hors du panneau produit un clic
      // sur le voile (ancêtre commun de l'appui et du relâcher) : la pile se
      // refermait à chaque swipe appuyé — et le refermer, c'est quitter.
      // La croix et Échap quittent.
      dismissOnBackdrop={!deckMounted}
    >
      <div className="flex flex-col" style={{ maxHeight: "94dvh" }}>
        {deckMounted && state && (
          <div className={view === "match" ? "hidden" : "flex min-h-0 flex-1 flex-col"}>
            <AffinityDeckView
              key={state.sessionId}
              state={state}
              titleId={deckTitleId}
              paused={view === "match"}
              onQuit={quit}
              onStale={onStale}
            />
          </div>
        )}
        {view === "kinds" && <AffinityKindsView state={state} titleId={viewTitleId} />}
        {view === "match" && state && proposal && <AffinityMatchView state={state} match={proposal} titleId={viewTitleId} />}
      </div>
    </Modal>
  );
}
