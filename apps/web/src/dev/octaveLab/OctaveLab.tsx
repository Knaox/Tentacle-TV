/**
 * LABO D'OCTAVE — `/dev/octave`, paquets de développement seulement (Vite en dev,
 * `build:web:debug` du bureau) ; absent des paquets livrés et du client LG.
 *
 * Les VRAIS écrans d'Octave (la coquille de bureau : rail, page, dock, file ; les vraies vues) sur
 * de FAUSSES données : aucun serveur, aucun Jellyfin, aucun son. Le banc `apps/web/bench/octave/`
 * les capture au Chrome sans tête — la preuve par l'image de la refonte de nov. 2026.
 *
 * `?vue=<scène>` choisit la scène (`labScenes.ts`). Trois faux, et rien d'autre :
 * - le SERVEUR (`labServer.ts`) : `fetch` répond lui-même à `/api/…` tant que le labo est monté —
 *   dans l'application de développement, les appels du reste de l'application aussi ;
 * - le CACHE (`labCache.ts`) : un client de requêtes à lui, pré-rempli ;
 * - le MOTEUR (`labPlayer.tsx`) : factice, repris par le vrai `OctavePlayerProvider`.
 *
 * Le labo a SON routeur (en mémoire) : l'adresse du navigateur ne bouge pas quand on y navigue.
 */

import { useLayoutEffect, useState, type ContextType, type ReactNode } from "react";
import { QueryClientProvider, type QueryClient } from "@tanstack/react-query";
import { MemoryRouter, Navigate, Route, Routes, UNSAFE_LocationContext, UNSAFE_RouteContext } from "react-router-dom";
import { JellyfinClientContext, TentacleConfigContext } from "@tentacle-tv/api-client";
import { PluginProvider } from "@tentacle-tv/plugins-api";
import { ToastProvider } from "../../contexts/ToastContext";
import { createLabQueryClient } from "./labCache";
import { LAB_SCENES, sceneFromLocation } from "./labScenes";
import { installLabServer } from "./labServer";
import { createLabSession, protectDeviceState, type LabSession } from "./labSession";
import { LabOctave } from "./labShell";

/**
 * « Aucun routeur au-dessus » : dans l'application, le labo est rendu SOUS son routeur, et
 * react-router refuse un routeur dans un autre. Les deux contextes remis à leur valeur d'origine
 * lèvent ce refus : le lieu (`null`), et la route parente — sans quoi les routes du labo se
 * liraient SOUS `/dev/octave` et ne correspondraient à rien.
 */
const NO_LOCATION = null as unknown as ContextType<typeof UNSAFE_LocationContext>;
const NO_PARENT_ROUTE: ContextType<typeof UNSAFE_RouteContext> = { outlet: null, matches: [], isDataRoute: false };

export function OctaveLab() {
  const [name] = useState(sceneFromLocation);
  const scene = LAB_SCENES[name];
  const [session] = useState(createLabSession);
  const [queryClient] = useState(() => createLabQueryClient(scene.rules));
  // Rien d'Octave ne se monte avant le faux serveur : aucune requête ne part vers un vrai.
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const restoreFetch = installLabServer(() => scene.rules);
    const restoreDevice = protectDeviceState();
    const title = document.title;
    document.title = `Labo d'Octave — ${scene.label}`;
    setReady(true);
    return () => {
      setReady(false);
      document.title = title;
      restoreDevice();
      restoreFetch();
    };
  }, [scene]);

  if (!ready) return null;
  return (
    <UNSAFE_LocationContext.Provider value={NO_LOCATION}>
      <UNSAFE_RouteContext.Provider value={NO_PARENT_ROUTE}>
        <LabProviders session={session} queryClient={queryClient}>
          <MemoryRouter initialEntries={[scene.path]}>
            <div data-octave-lab={name}>
              <Routes>
                <Route path="/octave/*" element={<LabOctave player={scene.player} />} />
                <Route path="*" element={<Navigate to="/octave" replace />} />
              </Routes>
            </div>
          </MemoryRouter>
        </LabProviders>
      </UNSAFE_RouteContext.Provider>
    </UNSAFE_LocationContext.Provider>
  );
}

/** Ce que `main.tsx` pose autour de l'application, ici factice : requêtes, session, extensions (aucune), avis. */
function LabProviders({ session, queryClient, children }: { session: LabSession; queryClient: QueryClient; children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TentacleConfigContext.Provider value={session.config}>
        <JellyfinClientContext.Provider value={session.client}>
          <PluginProvider backendUrl="">
            <ToastProvider>{children}</ToastProvider>
          </PluginProvider>
        </JellyfinClientContext.Provider>
      </TentacleConfigContext.Provider>
    </QueryClientProvider>
  );
}
