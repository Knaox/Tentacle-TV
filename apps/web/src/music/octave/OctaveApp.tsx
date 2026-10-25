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
import { OctaveCacheBoundary, useOctaveCacheWarmStart } from "./data/persist/OctaveCacheBoundary";
import { setOctaveMode } from "./mode/octaveMode";
import { useOctaveAvailability } from "./mode/useOctaveAvailability";
import { OctavePlayerProvider } from "./player/OctavePlayerProvider";
import { OctaveShell } from "./shell/OctaveShell";
import { AlbumView } from "./views/AlbumView";
import { ArtistView } from "./views/ArtistView";
import { HomeView } from "./views/HomeView";
import { LibraryView } from "./views/LibraryView";
import { LikedView } from "./views/LikedView";
import { PlaylistView } from "./views/PlaylistView";
import { ExternalPlaylistView } from "./views/ExternalPlaylistView";
import { PlaylistsView } from "./views/PlaylistsView";
import { SearchView } from "./views/SearchView";
import { SearchListenRecorder } from "./search/SearchListenRecorder";

export function OctaveApp() {
  const { available, settled } = useOctaveAvailability();
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
        <SearchListenRecorder />
        <OctaveShell onExit={exit}>
          <Routes>
            <Route index element={<HomeView />} />
            <Route path="search" element={<SearchView />} />
            <Route path="library" element={<LibraryView />} />
            <Route path="liked" element={<LikedView />} />
            <Route path="playlists" element={<PlaylistsView />} />
            <Route path="playlist/:id" element={<PlaylistView />} />
            <Route path="mix/:id" element={<ExternalPlaylistView />} />
            <Route path="album/:id" element={<AlbumView />} />
            <Route path="artist/:id" element={<ArtistView />} />
            <Route path="*" element={<Navigate to="." replace />} />
          </Routes>
        </OctaveShell>
      </OctavePlayerProvider>
    </OctaveCacheBoundary>
  );
}

export default OctaveApp;
