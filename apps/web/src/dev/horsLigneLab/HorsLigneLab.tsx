/**
 * LABO DU HORS LIGNE — `/dev/hors-ligne`, paquets de développement seulement ; absent des
 * paquets livrés et du client LG.
 *
 * Les VRAIS écrans de l'axe (la feuille de téléchargement, la file, « Sur cet appareil », les
 * fiches locales, les avis du mode hors ligne) nourris de données factices : on y juge un écran
 * sans serveur ni Jellyfin. `?vue=` choisit l'écran, `?etat=` son état.
 *
 * Il lui faut le PONT FACTICE du banc (`apps/web/bench/hors-ligne/`), posé avant le démarrage :
 * sans lui, ces écrans liraient et commanderaient le vrai moteur de la machine. La page le dit
 * et ne monte rien. Pour l'ouvrir en direct : `pnpm exec vite --config bench/hors-ligne/vite.config.ts`
 * (depuis apps/web) ; pour le capturer : `node bench/hors-ligne/capture.mjs`.
 */

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Route, Routes } from "react-router-dom";
import { useUserId } from "@tentacle-tv/api-client";
import { ToastProvider } from "../../contexts/ToastContext";
import { DOWNLOADS_LIST_QUERY_KEY } from "../../downloads/queryKeys";
import { OfflineSeriesView } from "../../downloads/OfflineSeriesView";
import { OfflineMediaDetail } from "../../downloads/detail/OfflineMediaDetail";
import { LAB_VIEWS, labViewOf, type LabView } from "./labViews";
import { labSnapshots } from "./labData";
import { applyQueueState, QUEUE_STATES, type QueueState } from "./labQueue";
import { labBridgePresent, labMachine, LAB_BRIDGE_MARK } from "./labStore";
import { LAB_GIB } from "./labData";

const params = (): URLSearchParams => new URLSearchParams(window.location.search);

export function HorsLigneLab() {
  if (!labBridgePresent()) return <NeedsBench />;
  return <Lab />;
}

function Lab() {
  const userId = useUserId();
  const view = labViewOf(params().get("vue"));
  const asked = params().get("etat");
  const queueState: QueueState = (QUEUE_STATES as readonly string[]).includes(asked ?? "") ? (asked as QueueState) : view.queue;

  // La machine factice et le cache, AVANT le premier rendu des écrans.
  const [client] = useState(() => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } });
    labMachine.snapshots = labSnapshots();
    labMachine.entries = applyQueueState(queueState, { fresh: true });
    labMachine.usedBytes = queueState === "vide" ? 0 : Math.round(31.6 * LAB_GIB);
    // `?espace=refus` : le moteur refusera la mise en file, faute d'espace (marge comprise).
    labMachine.refuseEnqueue = params().get("espace") === "refus" ? Math.round(16.2 * LAB_GIB) : null;
    if (labMachine.refuseEnqueue !== null) labMachine.freeBytes = Math.round(11.3 * LAB_GIB);
    queryClient.setQueryData([DOWNLOADS_LIST_QUERY_KEY, userId], labMachine.entries);
    // Le banc avance la file dans la MÊME page : le lot garde sa mémoire d'un état à l'autre.
    (window as unknown as Record<string, unknown>)[LAB_BRIDGE_MARK] = {
      setQueue(next: QueueState) {
        labMachine.entries = applyQueueState(next);
        queryClient.setQueryData([DOWNLOADS_LIST_QUERY_KEY, userId], labMachine.entries);
      },
    };
    return queryClient;
  });

  return (
    <QueryClientProvider client={client}>
      <ToastProvider>
        <div className="min-h-screen bg-surface-0 text-content-primary" data-lab-view={view.id}>
          <Routes>
            <Route path="/offline/series/:seriesKey" element={<OfflineSeriesView />} />
            <Route path="/offline/item/:itemId" element={<OfflineMediaDetail />} />
            <Route path="*" element={<view.Component state={queueState} />} />
          </Routes>
        </div>
      </ToastProvider>
    </QueryClientProvider>
  );
}

/** Sans le pont factice : ce qu'est le labo, et comment l'ouvrir — rien n'est monté. */
function NeedsBench() {
  return (
    <div className="min-h-screen bg-surface-0 text-content-primary">
      <div className="mx-auto flex max-w-[720px] flex-col gap-4 px-6 py-16">
        <span className="ui-eyebrow">Labo · refonte de nov. 2026</span>
        <h1 className="font-display text-display-3">Le hors ligne</h1>
        <p className="max-w-[65ch] text-sm leading-relaxed text-content-secondary">
          Ce labo rend les vrais écrans du hors ligne avec une machine factice. Il lui faut le pont factice de son banc :
          ouvert ici, il lirait et commanderait le vrai moteur de cette machine. Depuis <code>apps/web</code> :
        </p>
        <pre className="ui-panel overflow-x-auto p-4 text-[13px] leading-relaxed text-content-secondary">
          {"pnpm exec vite --config bench/hors-ligne/vite.config.ts   # en direct\nnode bench/hors-ligne/capture.mjs <dossier>               # les captures"}
        </pre>
        <p className="text-[13px] text-content-tertiary">Vues : {LAB_VIEWS.map((entry: LabView) => entry.id).join(" · ")}</p>
      </div>
    </div>
  );
}
