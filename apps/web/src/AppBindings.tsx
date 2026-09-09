import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GlassFilters } from "@tentacle-tv/ui";
import {
  useJellyfinClient,
  useStreamingConfig,
  STREAMING_CONFIG_QUERY_KEY,
  primeBitrateMeasure,
} from "@tentacle-tv/api-client";
import { ImpersonationBanner } from "./components/ImpersonationBanner";
import { RecoLiveBinding } from "./components/reco/RecoLiveBinding";
import { PreferencesLiveBinding } from "./components/reco/PreferencesLiveBinding";
import { RecoFilterBinding } from "./components/reco/RecoFilterBinding";
import { RecoPrefetchBoot } from "./components/reco/RecoPrefetchBoot";
import { ConnectivityBinding } from "./offline/ConnectivityBinding";
import { DataSaverBinding } from "./offline/DataSaverBinding";
import { OfflineSessionSync } from "./offline/OfflineSessionSync";
import { OfflineSwitchBanner } from "./offline/OfflineSwitchBanner";
import { DownloadsEngineBoot } from "./downloads/DownloadsEngineBoot";
import { DownloadsEvents } from "./downloads/DownloadsEvents";
import { DownloadRequestHost } from "./downloads/DownloadRequestHost";
import { SoakHarness } from "./dev/soakPlayer";
import { AutoWatchHarness } from "./dev/autoWatch";
import { FrameMeter, frameMeterEnabled } from "./dev/FrameMeter";
import { useDirectStreamingGuard } from "./hooks/useDirectStreamingGuard";
import { useScrollMemory } from "./hooks/useScrollMemory";

interface AppBindingsProps {
  authed: boolean;
  offlineMode: boolean;
}

/**
 * Les ponts et les bandeaux de session — tout ce que l'application monte près
 * de sa racine sans que cela occupe la moindre place à l'écran : filtres SVG,
 * liaisons vers les magasins, fils temps réel, bandeaux d'état, outils de
 * développement.
 *
 * Extrait d'`App.tsx` sans rien changer : même ordre de montage, mêmes
 * conditions. Le fichier dépassait les 300 lignes du dépôt, et ce bloc y
 * formait déjà un ensemble homogène — on ne le lisait jamais en même temps que
 * la table des routes.
 */
export function AppBindings({ authed, offlineMode }: AppBindingsProps) {
  return (
    <>
      {/* Definitions SVG de la refraction Liquid Glass. Montees UNE fois pres
          de la racine : les surfaces verre y referent par `url(#...)`, un
          filtre non monte resoudrait sur rien et le verre retomberait
          silencieusement sur un flou plat. */}
      <GlassFilters />
      {/* Pont connectivité ↔ TanStack : erreurs réseau → sonde, retour en
          ligne → invalidations échelonnées. Web ET desktop. */}
      <ConnectivityBinding />
      {/* Décide du mode économie (réglage ∘ latence mesurée) et le pousse dans
          api-client — avant que le moindre queryFn ne s'exécute. */}
      <DataSaverBinding />
      {/* Desktop : photo de session (profil+droits) rafraîchie en ligne, et
          garde « reconnexion nécessaire » à l'expiration des 30 j hors ligne. */}
      {authed && <OfflineSessionSync />}
      {/* Le bandeau qui EXPLIQUE la bascule automatique — desktop uniquement,
          et seulement à la transition. */}
      {authed && <OfflineSwitchBanner />}
      {authed && <DownloadsEngineBoot />}
      {authed && <DownloadsEvents />}
      {/* Le dialogue des demandes parties d'une CARTE : le bouton qui le
          déclenche est démonté dès que le curseur s'en va, il ne peut pas le
          porter (cf. downloadRequest.ts). */}
      {authed && <DownloadRequestHost />}
      {authed && <DirectStreamingSync />}
      {authed && <ImpersonationBanner />}
      {/* Fil temps réel des recommandations : la page en cache se rafraîchit
          en silence quand le serveur l'a reconstruite. */}
      {authed && <RecoLiveBinding />}
      {/* Un réglage enregistré sur un autre appareil arrive en direct :
          accueil et réglages de recommandation se relisent en silence. */}
      {authed && <PreferencesLiveBinding />}
      {/* Le filtre de plateformes suit le compte pour toute la session — il
          vaut sur l'accueil, pas seulement sur la page Recommandations. */}
      {authed && !offlineMode && <RecoFilterBinding />}
      {/* Préchargement de la page Recommandations en temps mort : arriver sur
          la page ne montre ni spinner ni squelette. */}
      {authed && <RecoPrefetchBoot />}
      <ScrollMemoryWrapper />
      {/* Banc de torture du lecteur (dev only) : tentacleSoak("<itemId>", 200) */}
      {import.meta.env.DEV && <SoakHarness />}
      {/* Reprise auto d'une lecture (dev only, URL ?autowatch=<itemId>).
          `__PLAYER_DEBUG__` aussi : la coquille Electron sert un build Vite de
          PRODUCTION même en développement, où `import.meta.env.DEV` est faux —
          sans cette porte, l'outil n'existait sur aucune des deux coquilles de
          bureau, celles-là mêmes pour lesquelles il a été écrit. */}
      {(import.meta.env.DEV || __PLAYER_DEBUG__) && <AutoWatchHarness />}
      {/* Compteur d'images (dev only) — éliminé du build de production. */}
      {import.meta.env.DEV && frameMeterEnabled() && <FrameMeter />}
    </>
  );
}

/** Sync direct streaming config from backend into JellyfinClient.
 *  Auto-disables and refetches config when consecutive media errors occur. */
function DirectStreamingSync() {
  const client = useJellyfinClient();
  const queryClient = useQueryClient();
  // Web uses httpOnly cookie (credentials: "include"), so pass a sentinel token
  // to satisfy the `enabled: !!token` guard. Mobile/desktop pass real token.
  const token = localStorage.getItem("tentacle_token") || (localStorage.getItem("tentacle_user") ? "__cookie__" : null);
  const { data } = useStreamingConfig(token);

  // Préchauffage de la mesure de débit (miroir du téléviseur) : la PREMIÈRE
  // lecture après le lancement peut déjà être capée — cache 10 min.
  useEffect(() => {
    if (token) primeBitrateMeasure(client);
  }, [client, token]);

  useEffect(() => {
    // Direct Streaming is applied on every client (web/native) when the admin
    // enabled it. On web, CORS may block the direct call — the transparent
    // fallback lives in 3 places:
    //   - packages/api-client/src/jellyfin.ts (getPlaybackInfo direct → proxy)
    //   - apps/web/src/components/VideoPlayer.tsx (HLS manifestLoadError → DS off + refetch)
    //   - apps/web/src/hooks/useDirectStreamingGuard.ts (auto-disable after N <img>/<video> errors)
    // The admin config is never touched; only the in-memory session flag is cleared.
    if (data?.enabled && data.mediaBaseUrl && data.jellyfinToken) {
      client.setDirectStreaming({
        enabled: true,
        mediaBaseUrl: data.mediaBaseUrl,
        jellyfinToken: data.jellyfinToken,
      });
    } else {
      client.setDirectStreaming(null);
    }
  }, [client, data]);

  // Register fallback: on consecutive direct streaming errors, force refetch
  useEffect(() => {
    client.setOnDirectStreamingFail(() => {
      queryClient.invalidateQueries({ queryKey: [STREAMING_CONFIG_QUERY_KEY] });
    });
  }, [client, queryClient]);

  // Global image error listener for direct streaming URLs
  useDirectStreamingGuard();

  return null;
}

function ScrollMemoryWrapper() {
  useScrollMemory();
  return null;
}
