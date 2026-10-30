/**
 * Octave — l'application musique, chargée à la demande (`App.tsx` → `/octave/*`).
 * Rien de ce module n'est téléchargé tant que le mode n'est pas ouvert.
 *
 * Garde : la capacité `music.library` ET une bibliothèque musique visible
 * (`useOctaveAvailability`). Sinon, retour à l'accueil et le mode s'éteint —
 * aucune trace de la musique chez un compte qui n'en a pas.
 */

import { useCallback, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "./octave.css";
import { resetLikeOverrides } from "./actions/likeOverrides";
import { OctavePageResume } from "./cache/OctavePageResume";
import { OctaveCacheBoundary, useOctaveCacheWarmStart } from "./data/persist/OctaveCacheBoundary";
import { setOctaveMode } from "./mode/octaveMode";
import { useOctaveLaunchAvailability } from "./mode/useOctaveLaunchAvailability";
import { octaveEnginePrefs, OctavePlayerProvider } from "./player/OctavePlayerProvider";
import type { MusicEngineAuth } from "../engine";
import { prestartAudioEngine } from "../engine/enginePrestart";
import { OctaveShell } from "./shell/OctaveShell";
import { AlbumView } from "./views/AlbumView";
import { ArtistView } from "./views/ArtistView";
import { HomeView } from "./views/HomeView";
import { LibraryView } from "./views/LibraryView";
import { LikedView } from "./views/LikedView";
import { PlaylistView } from "./views/PlaylistView";
import { ImportShareEntry } from "./import/ImportShareEntry";
import { ExternalPlaylistView } from "./views/ExternalPlaylistView";
import { MoodView } from "./moods/MoodView";
import { MixView } from "./home/MixView";
import { PlaylistsView } from "./views/PlaylistsView";
import { SearchView } from "./views/SearchView";
import { SearchListenRecorder } from "./search/SearchListenRecorder";
import { DeviceView } from "./offline/DeviceView";
import { OctaveSettingsView } from "./settings/OctaveSettingsView";
import { OctaveProfilesView } from "./profiles/OctaveProfilesView";
import { MusicOfflineScope } from "./offline/MusicOfflineScope";
import { OfflineOctaveRoutes } from "./offline/OfflineOctave";

export function OctaveApp() {
  // Au lancement, le miroir de la dernière réponse peint Octave sans attendre ; le serveur corrige ensuite.
  // Hors ligne (une panne, jamais une absence) : Octave reste, « Sur cet appareil » (`offline/OfflineOctave.tsx`).
  const { available, settled } = useOctaveLaunchAvailability();
  useOctaveCacheWarmStart();
  const navigate = useNavigate();

  // Entrer par une adresse `/octave/...`, c'est allumer le mode ; sans musique, il s'éteint.
  useEffect(() => {
    if (settled) setOctaveMode(available);
  }, [available, settled]);
  useEffect(() => resetLikeOverrides, []);

  const exit = useCallback(() => {
    setOctaveMode(false);
    navigate("/", { replace: true });
  }, [navigate]);

  if (!settled) return null;
  if (!available) return <Navigate to="/" replace />;

  return (
    <OctaveCacheBoundary>
      <OctavePlayerProvider>
        <MusicOfflineScope>
          <SearchListenRecorder />
          <OctaveShell onExit={exit}>
            {/* Sans réseau : « Sur cet appareil » seulement (`offline/OfflineOctave.tsx`). */}
            <OfflineOctaveRoutes>
              <Routes>
                <Route index element={<HomeView />} />
                <Route path="search" element={<SearchView />} />
                <Route path="library" element={<LibraryView />} />
                <Route path="liked" element={<LikedView />} />
                <Route path="playlists" element={<PlaylistsView />} />
                <Route path="import" element={<ImportShareEntry />} />
                <Route path="playlist/:id" element={<PlaylistView />} />
                <Route path="mix/:id" element={<ExternalPlaylistView />} />
                <Route path="mood/:id" element={<MoodView />} />
                <Route path="home-mix/:id" element={<MixView />} />
                <Route path="album/:id" element={<AlbumView />} />
                <Route path="artist/:id" element={<ArtistView />} />
                <Route path="device" element={<DeviceView />} />
                <Route path="settings" element={<OctaveSettingsView />} />
                <Route path="profiles" element={<OctaveProfilesView />} />
                <Route path="*" element={<Navigate to="." replace />} />
              </Routes>
            </OfflineOctaveRoutes>
          </OctaveShell>
          {/* Après la coquille : la page gardée retrouve son défilement après la remise en haut d'une page neuve. */}
          <OctavePageResume />
        </MusicOfflineScope>
      </OctavePlayerProvider>
    </OctaveCacheBoundary>
  );
}

export default OctaveApp;

/** Préparer l'entrée (la bascule) : le cache gardé, lu avant le premier rendu. */
export { warmOctaveCache } from "./data/persist/OctaveCacheBoundary";

/** Démarrer le moteur au GESTE de la bascule (jamais avant) ; `AudioEngineProvider` le reprend. */
export function prestartOctaveEngine(auth: MusicEngineAuth): void {
  prestartAudioEngine(auth, octaveEnginePrefs());
}
