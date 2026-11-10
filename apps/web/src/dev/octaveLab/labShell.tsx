/**
 * Labo d'Octave — l'arbre d'`OctaveApp` (`music/octave/OctaveApp.tsx`), REJOUÉ : la vraie coquille
 * de bureau, les vraies vues, la même table de routes et les mêmes `OctaveSubview` (le bouton
 * Retour des vues qui ne sont pas des racines). ⚠️ Recopie : une route ajoutée à `OctaveApp`
 * s'ajoute ici.
 *
 * Ce qui diffère, et pourquoi :
 * - pas de porte de disponibilité ni de `setOctaveMode` : le labo n'allume pas le mode de l'appareil ;
 * - pas d'`OctaveCacheBoundary` ni d'`OctavePageResume` : ils liraient et écriraient le cache GARDÉ
 *   du vrai compte avec de fausses pages ;
 * - `LabEngineArm` (le moteur factice) et `LabPlayerScene` (l'état du lecteur de la scène).
 */

import { useCallback, useEffect } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import "../../music/octave/octave.css";
import { resetLikeOverrides } from "../../music/octave/actions/likeOverrides";
import { MixView } from "../../music/octave/home/MixView";
import { ImportShareEntry } from "../../music/octave/import/ImportShareEntry";
import { MoodView } from "../../music/octave/moods/MoodView";
import { DeviceView } from "../../music/octave/offline/DeviceView";
import { MusicOfflineScope } from "../../music/octave/offline/MusicOfflineScope";
import { OfflineOctaveRoutes } from "../../music/octave/offline/OfflineOctave";
import { OctavePlayerProvider } from "../../music/octave/player/OctavePlayerProvider";
import { OctaveProfilesView } from "../../music/octave/profiles/OctaveProfilesView";
import { SearchListenRecorder } from "../../music/octave/search/SearchListenRecorder";
import { OctaveSettingsView } from "../../music/octave/settings/OctaveSettingsView";
import { OctaveSubview } from "../../music/octave/shell/OctaveBackButton";
import { OctaveShell } from "../../music/octave/shell/OctaveShell";
import { AlbumView } from "../../music/octave/views/AlbumView";
import { ArtistView } from "../../music/octave/views/ArtistView";
import { ExternalPlaylistView } from "../../music/octave/views/ExternalPlaylistView";
import { HomeView } from "../../music/octave/views/HomeView";
import { LibraryView } from "../../music/octave/views/LibraryView";
import { LikedView } from "../../music/octave/views/LikedView";
import { PlaylistsView } from "../../music/octave/views/PlaylistsView";
import { PlaylistView } from "../../music/octave/views/PlaylistView";
import { SearchView } from "../../music/octave/views/SearchView";
import { LabEngineArm, LabPlayerScene, type LabPlayerState } from "./labPlayer";

export function LabOctave({ player }: { player: LabPlayerState }) {
  const navigate = useNavigate();
  useEffect(() => resetLikeOverrides, []);
  // « Quitter Octave » ne mène nulle part hors du labo : retour à son accueil.
  const exit = useCallback(() => navigate("/octave", { replace: true }), [navigate]);

  return (
    <>
      <LabEngineArm />
      <OctavePlayerProvider>
        <LabPlayerScene state={player} />
        <MusicOfflineScope>
          <SearchListenRecorder />
          <OctaveShell onExit={exit}>
            <OfflineOctaveRoutes>
              <Routes>
                <Route index element={<HomeView />} />
                <Route path="search" element={<SearchView />} />
                <Route path="library" element={<LibraryView />} />
                <Route path="liked" element={<LikedView />} />
                <Route path="playlists" element={<PlaylistsView />} />
                <Route path="import" element={<ImportShareEntry />} />
                <Route path="playlist/:id" element={<OctaveSubview><PlaylistView /></OctaveSubview>} />
                <Route path="mix/:id" element={<OctaveSubview><ExternalPlaylistView /></OctaveSubview>} />
                <Route path="mood/:id" element={<OctaveSubview><MoodView /></OctaveSubview>} />
                <Route path="home-mix/:id" element={<OctaveSubview><MixView /></OctaveSubview>} />
                <Route path="album/:id" element={<OctaveSubview><AlbumView /></OctaveSubview>} />
                <Route path="artist/:id" element={<OctaveSubview><ArtistView /></OctaveSubview>} />
                <Route path="device" element={<DeviceView />} />
                <Route path="settings" element={<OctaveSettingsView />} />
                <Route path="profiles" element={<OctaveSubview><OctaveProfilesView /></OctaveSubview>} />
                <Route path="*" element={<Navigate to="." replace />} />
              </Routes>
            </OfflineOctaveRoutes>
          </OctaveShell>
        </MusicOfflineScope>
      </OctavePlayerProvider>
    </>
  );
}
