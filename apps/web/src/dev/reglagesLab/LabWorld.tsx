/**
 * Le MONDE du labo : les vrais écrans des réglages, de l'administration, de la connexion et des
 * profils, montés sur un faux serveur (`labFetch`) — sa propre racine React, pour porter son
 * routeur en mémoire (deux routeurs ne s'imbriquent pas), son cache de requêtes et ses
 * fournisseurs. Rien du monde ne fuit dans l'application qui l'héberge.
 */

import { Suspense, useEffect, useRef, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  JellyfinClient, JellyfinClientContext, TentacleConfigContext, WebStorageAdapter, WebUuidGenerator, resyncPlaybackSettings,
} from "@tentacle-tv/api-client";
import { PluginProvider } from "@tentacle-tv/plugins-api";

import { ToastProvider } from "../../contexts/ToastContext";
import { ThemeProvider } from "../../theme";
import { installLabFetch, type LabRoute } from "./labFetch";

export interface LabWorldProps {
  /** L'adresse ouverte dans le routeur du monde (`/settings/playback#upNext`). */
  path: string;
  /** Le faux serveur de cette vue. */
  routes: readonly LabRoute[];
  /** Le banc : une adresse sans donnée est notée au lieu de partir au vrai serveur. */
  strict: boolean;
  children: ReactNode;
}

function World({ path, children }: Pick<LabWorldProps, "path" | "children">) {
  const world = useRef<{ queryClient: QueryClient; client: JellyfinClient; storage: WebStorageAdapter; uuid: WebUuidGenerator } | null>(null);
  if (!world.current) {
    const storage = new WebStorageAdapter();
    const uuid = new WebUuidGenerator();
    const client = new JellyfinClient("/api/jellyfin", storage, uuid, "Web", "Tentacle TV - Labo", "0.0.0");
    client.useCredentials = true;
    world.current = {
      storage, uuid, client,
      queryClient: new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: Infinity }, mutations: { retry: false } } }),
    };
  }
  const { queryClient, client, storage, uuid } = world.current;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <TentacleConfigContext.Provider value={{ storage, uuid }}>
          <JellyfinClientContext.Provider value={client}>
            <PluginProvider backendUrl="">
              <MemoryRouter initialEntries={["/", path]} initialIndex={1}>
                <ToastProvider>
                  <Suspense fallback={null}>{children}</Suspense>
                </ToastProvider>
              </MemoryRouter>
            </PluginProvider>
          </JellyfinClientContext.Provider>
        </TentacleConfigContext.Provider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export function LabWorld({ path, routes, strict, children }: LabWorldProps) {
  const host = useRef<HTMLDivElement>(null);
  // Le monde ne change pas en cours de vie : une autre vue recharge la page (`?vue=`).
  const first = useRef({ path, routes, strict, children });

  useEffect(() => {
    if (!host.current) return;
    const { path: at, routes: table, strict: isStrict, children: screen } = first.current;
    const restore = installLabFetch(table, { strict: isStrict });
    // Ce que l'application fait à l'ouverture d'une session (`AppBindings`) : relire au serveur les
    // réglages de lecture du compte — sans quoi Réglages › Lecture ne montre que les valeurs livrées.
    resyncPlaybackSettings();
    const root = createRoot(host.current);
    root.render(<World path={at}>{screen}</World>);
    return () => {
      restore();
      // Hors du rendu en cours : React refuse de démonter une racine pendant un rendu.
      setTimeout(() => root.unmount(), 0);
    };
  }, []);

  return <div ref={host} data-lab-world />;
}
