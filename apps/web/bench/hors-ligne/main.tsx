/**
 * Le labo du hors ligne, SEUL : la page `/dev/hors-ligne` rendue sans l'application ni serveur,
 * pour la capturer au Chrome sans tête (`capture.mjs`). Elle charge la vraie feuille
 * (`index.css`) et les vrais écrans ; le pont du bureau et le serveur sont factices
 * (`fakeBridge.ts`). `?theme=light|dark`, `?vue=…`, `?etat=…`, `?reseau=coupe`.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../../src/index.css";
import { installFakeBridge } from "./fakeBridge";

// AVANT tout module de l'application : la détection de la coquille est figée à l'import.
installFakeBridge();

const query = new URLSearchParams(window.location.search);

async function boot(): Promise<void> {
  const [{ QueryClient, QueryClientProvider }, { MemoryRouter }, api, shared, { ThemeProvider }, { setMode }, { HorsLigneLab }, { labViewOf }] = await Promise.all([
    import("@tanstack/react-query"),
    import("react-router-dom"),
    import("@tentacle-tv/api-client"),
    import("@tentacle-tv/shared"),
    import("../../src/theme"),
    import("../../src/theme/colorScheme"),
    import("../../src/dev/horsLigneLab/HorsLigneLab"),
    import("../../src/dev/horsLigneLab/labViews"),
  ]);

  shared.initI18n({ lng: query.get("langue") === "en" ? "en" : "fr" });
  const theme = query.get("theme");
  if (theme === "light" || theme === "dark") setMode(theme);

  const storage = new api.WebStorageAdapter();
  const uuid = new api.WebUuidGenerator();
  const jellyfin = new api.JellyfinClient("/api/jellyfin", storage, uuid, "Desktop", "Tentacle Lab", "0.0.0");
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <api.TentacleConfigContext.Provider value={{ storage, uuid }}>
            <api.JellyfinClientContext.Provider value={jellyfin}>
              {/* Les fiches locales lisent leurs paramètres dans l'adresse : la vue dit la sienne. */}
              <MemoryRouter initialEntries={[labViewOf(query.get("vue")).path]}>
                <HorsLigneLab />
              </MemoryRouter>
            </api.JellyfinClientContext.Provider>
          </api.TentacleConfigContext.Provider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}

void boot();
