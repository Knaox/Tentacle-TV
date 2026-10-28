/**
 * Octave — le PARTAGE d'une playlist (capacité `music.playlistShare`, contrat `musicShare.ts`) : la porte
 * (le serveur sait partager ET le compte a le droit « Partage public » — sinon aucun bouton, aucune
 * requête), le lien de la playlist, le créer, le révoquer. Web large, web étroit et mobile lisent ceci.
 */

import { useCallback, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MUSIC_SHARE_ROUTES, type MusicPlaylistShareState } from "@tentacle-tv/shared/music";
import { tentacleApiFetch } from "../hooks/usePreferences";
import { useServerCapability } from "../hooks/useServerCapabilities";
import { usePublicSharingAllowed } from "../hooks/useShareLink";
import { useMusicCapability } from "./useMusicLibrary";

const ownerRoute = (playlistId: string) => MUSIC_SHARE_ROUTES.owner.replace(":id", encodeURIComponent(playlistId));

export const musicShareApi = {
  state: (playlistId: string, signal?: AbortSignal) => tentacleApiFetch<MusicPlaylistShareState>(ownerRoute(playlistId), { signal }),
  create: (playlistId: string) => tentacleApiFetch<MusicPlaylistShareState>(ownerRoute(playlistId), { method: "POST", body: "{}" }),
  revoke: (playlistId: string) => tentacleApiFetch<MusicPlaylistShareState>(ownerRoute(playlistId), { method: "DELETE" }),
};

export const musicShareKey = (playlistId: string) => ["music", "share", playlistId] as const;

/**
 * La porte du partage (règle 15), PURE : le serveur a la musique ET sait partager ET ce compte a le droit
 * « Partage public » (session personnelle, jamais un invité : `usePublicSharingAllowed`). Faux tant que ce
 * n'est pas su. Elle garde « Partager » ET l'import du lien d'un autre Tentacle (le serveur refuse pareil).
 */
export function playlistShareShown(gate: { music: boolean; capable: boolean; allowed: boolean }): boolean {
  return gate.music && gate.capable && gate.allowed;
}

/** « Partager » s'offre-t-il ? Le serveur le sait ET ce compte peut partager en public. */
export function useMusicPlaylistShareAvailable(): boolean {
  const music = useMusicCapability();
  const capable = useServerCapability("music.playlistShare");
  const allowed = usePublicSharingAllowed();
  return playlistShareShown({ music, capable, allowed });
}

/** Un lien de partage d'un autre Tentacle s'importe-t-il ici ? L'import ET la porte du partage. */
export function useMusicShareLinkImport(): boolean {
  const importable = useServerCapability("music.playlistImport");
  return useMusicPlaylistShareAvailable() && importable;
}

/** Le lien de cette playlist (`null` : pas partagée), et les gestes pour le créer ou le révoquer. */
export function useMusicPlaylistShare(playlistId: string | null, enabled = true) {
  const available = useMusicPlaylistShareAvailable();
  const qc = useQueryClient();
  const on = available && enabled && !!playlistId;
  const query = useQuery({
    queryKey: musicShareKey(playlistId ?? ""),
    queryFn: ({ signal }) => musicShareApi.state(playlistId!, signal),
    enabled: on,
    staleTime: 30_000,
  });
  const [busy, setBusy] = useState<"create" | "revoke" | null>(null);
  const [failed, setFailed] = useState(false);

  const run = useCallback(
    async (kind: "create" | "revoke") => {
      if (!playlistId) return null;
      setBusy(kind);
      setFailed(false);
      try {
        const next = await (kind === "create" ? musicShareApi.create(playlistId) : musicShareApi.revoke(playlistId));
        qc.setQueryData(musicShareKey(playlistId), next);
        return next.share;
      } catch {
        setFailed(true);
        // Un refus du droit (403) : la porte se relit, le bouton s'en va.
        void qc.invalidateQueries({ queryKey: ["share", "access"] });
        return null;
      } finally {
        setBusy(null);
      }
    },
    [playlistId, qc],
  );

  return {
    available,
    loading: on && query.isPending,
    share: query.data?.share ?? null,
    busy,
    failed,
    create: useCallback(() => run("create"), [run]),
    revoke: useCallback(() => run("revoke"), [run]),
  };
}
