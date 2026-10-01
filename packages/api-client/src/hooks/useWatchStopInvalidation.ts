import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MediaItem } from "@tentacle-tv/shared";
import { useJellyfinClient } from "./useJellyfinClient";
import { useUserId } from "./useUserId";
import {
  updateItemUserDataInCache, patchSeriesIdSet, hoistResumeItem, invalidateSeriesWatchViews,
} from "./cacheUtils";
import {
  retireSeriesFromWatchlistIfFullyWatched, stoppedPastHalf, WATCHLIST_SERIES_IDS_KEY,
} from "./watchlistEffects";
import { clearPlayedWhenResumable } from "./resumeOverPlayed";
import { projectionPatch, projectStop, stopWorthDefending } from "./stopProjection";
import { rememberStop } from "./recentStopGuard";
import type { AutoplayConfig } from "./useConfig";

/**
 * Hubs de la home à rafraîchir à l'arrêt. « resume-items » est traité à part :
 * on n'attend QUE lui pour remettre l'ordre local par-dessus sa réponse, sans
 * dépendre du plus lent des quatre.
 */
const STOP_INVALIDATE_KEYS = ["next-up", "watched-items", "watchlist"] as const;
const RESUME_HUB = ["resume-items"] as const;


interface StopArgs {
  itemId?: string;
  /** Présent si l'item lu est un ÉPISODE → série parente. */
  seriesId?: string;
  itemType?: string;
  /** Position au moment de l'arrêt, en secondes — inconnue, le serveur tranche seul. */
  stopPositionSeconds?: number;
  /** Durée du média (`RunTimeTicks`), pour situer la position d'arrêt. */
  runtimeTicks?: number;
  /** L'instant de l'arrêt (ms, horloge de l'appareil) — la garde le compare à
   *  `LastPlayedDate` ; à défaut, l'instant de l'appel. */
  stoppedAt?: number;
  /** L'envoi de l'arrêt en cours : le patch local part AUSSITÔT, le réseau
   *  attend qu'il soit posté. Absent : l'appelant a déjà attendu. */
  stopped?: Promise<unknown>;
}

/**
 * Logique d'invalidation à l'ARRÊT de lecture, partagée web/desktop.
 *
 * Retrait de « Ma liste » après un visionnage COMPLET — et seulement après un
 * visionnage : marquer vu à la main ne retire rien (cf. useWatchedToggle).
 * - Film : on retire le like UNIQUEMENT si Jellyfin a marqué l'item `Played`
 *   (≥ son seuil de fin), pas au simple lancement du player.
 * - Épisode : on ne touche pas au like de l'épisode ; si la série devient
 *   entièrement vue, c'est ELLE qui quitte Ma liste.
 * - Dans les deux cas, la position d'arrêt doit dépasser la moitié du média
 *   (`stoppedPastHalf`) : un titre déjà marqué vu à la main, lancé puis quitté
 *   dans les premières secondes, garde son `Played` — le serveur seul le
 *   croirait vu jusqu'au bout.
 */
export function useWatchStopInvalidation() {
  const qc = useQueryClient();
  const client = useJellyfinClient();
  const userId = useUserId();

  return useCallback(
    async ({ itemId, seriesId, itemType, stopPositionSeconds, runtimeTicks, stoppedAt, stopped }: StopArgs) => {
      if (!itemId || !userId) return;

      // AVANT tout réseau, à l'instant de la sortie : la fiche et les listes
      // montrent l'arrêt (Jellyfin 12.1 l'écrit parfois des secondes plus tard,
      // ou jamais — cf. `stopProjection.ts`), et une relecture plus ancienne
      // ne les fait plus reculer (`recentStopGuard.ts`).
      const maxResumePct = qc.getQueryData<AutoplayConfig>(["autoplay-config"])?.maxResumePct;
      const projection = stopPositionSeconds === undefined
        ? null
        : projectStop({ positionSeconds: stopPositionSeconds, runtimeTicks, maxResumePct });
      if (projection && runtimeTicks) {
        updateItemUserDataInCache(qc, itemId, () => projectionPatch(projection, runtimeTicks));
        if (stopWorthDefending(projection, runtimeTicks, maxResumePct)) {
          rememberStop(qc, client, userId, { ...projection, itemId, runtimeTicks, stoppedAt: stoppedAt ?? Date.now() });
        }
      }

      // « Reprendre la lecture » se réordonne à l'instant. Ce qu'on vient de
      // lire est le plus récent, on n'a personne à qui le demander (cf.
      // `hoistResumeItem`).
      hoistResumeItem(qc, itemId);
      if (stopped) await stopped.catch(() => {});

      // AVANT les invalidations, et c'est tout l'ordre qui compte : les hubs
      // repartent chercher leur vérité juste après, et ils doivent la trouver
      // corrigée. Sans effet dans l'écrasante majorité des sorties de lecture —
      // voir `resumeOverPlayed.ts` pour la seule situation qu'elle vise.
      const resumed = await clearPlayedWhenResumable(client, itemId, userId);
      if (resumed !== null) {
        // `PlayedPercentage` n'est PAS repeint : il se déduit de la position
        // côté serveur, et la réponse qui arrive dans la seconde le corrige.
        updateItemUserDataInCache(qc, itemId, () => ({
          Played: false,
          PlaybackPositionTicks: resumed,
        }));
      }

      // Position inconnue (appelant qui ne la fournit pas) → verdict serveur seul.
      const mayRetire = stoppedPastHalf(stopPositionSeconds, runtimeTicks) !== false;

      if (itemType === "Episode" && seriesId) {
        // L'état de la série est redemandé au serveur par le retrait lui-même,
        // et posé dans le cache — qu'une fiche l'ait créé ou non.
        if (mayRetire) await retireSeriesFromWatchlistIfFullyWatched(qc, client, userId, seriesId);
        // La fiche de la série, ses saisons et sa liste d'épisodes — voir
        // `invalidateSeriesWatchViews`, partagée avec le mobile et le téléviseur.
        invalidateSeriesWatchViews(qc, seriesId);
      } else if (mayRetire) {
        const fresh = await client
          .fetch<MediaItem>(`/Users/${userId}/Items/${itemId}?EnableUserData=true`)
          .catch(() => null);
        if (fresh?.UserData?.Played === true) {
          await client
            .fetch(`/Users/${userId}/Items/${itemId}/Rating`, { method: "DELETE" })
            .catch(() => {});
          updateItemUserDataInCache(qc, itemId, () => ({ Likes: false }));
          patchSeriesIdSet(qc, WATCHLIST_SERIES_IDS_KEY, itemId, false);
        }
      }

      qc.invalidateQueries({ queryKey: ["item", itemId] });
      // `refetchType: "all"` et non le défaut « active » : ces hubs ne sont
      // MONTÉS NULLE PART à l'instant où l'on sort du lecteur — la page qui les
      // affiche n'est pas encore arrivée. Une invalidation les marquait alors
      // seulement périmés, et la fraîcheur retombait sur le `refetchOnMount` de
      // la query qui remonte. La requête part maintenant, pendant la navigation.
      const resumeRefetched = qc.invalidateQueries({ queryKey: RESUME_HUB, refetchType: "all" });
      for (const k of STOP_INVALIDATE_KEYS) qc.invalidateQueries({ queryKey: [k], refetchType: "all" });
      qc.invalidateQueries({ queryKey: WATCHLIST_SERIES_IDS_KEY });

      // Une fois la réponse écrite : on remet notre ordre par-dessus. Une réponse
      // partie trop tôt pour voir le `DatePlayed` mis à jour ne doit pas défaire
      // ce qu'on sait de source sûre. Sans effet si elle était juste.
      await resumeRefetched.catch(() => {});
      hoistResumeItem(qc, itemId);
    },
    [qc, client, userId],
  );
}
