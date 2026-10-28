/**
 * Octave mobile — « Titres likés », comme le bureau : les favoris Jellyfin du compte, et à leur place ce
 * qu'on vient d'aimer hors bibliothèque, « en attente », lisible tout de suite. Le dernier like en tête ;
 * chercher, filtrer, trier, et glisser un titre à sa place (ordre gardé par le COMPTE, suivi en direct par ses
 * autres appareils). Les likés arrivent par pages de 500 : le glisser attend la fin du chargement.
 */

import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Heart, Search } from "lucide-react-native";
import { queueActions } from "@tentacle-tv/shared/octave";
import { usePagesPlayer } from "../../pages";
import { playFrom } from "../../pages/env/playFrom";
import { KeepLikedButton } from "../../offline/KeepLikedButton";
import { useOctaveNav } from "../../pages/env/nav";
import { useCountAndDuration } from "../../pages/entity/useCountAndDuration";
import { EmptyState, ErrorState, PillButton } from "../../pages/ui/ViewStates";
import { useLikedData } from "../data/useListData";
import { LikedHero } from "./LikedHero";
import { ListPage } from "./ListPage";
import { LIKED_COLLECTION_KEY } from "@tentacle-tv/offline-core/music";
import { OfflinePageFallback } from "../../offline/OfflinePageFallback";
import { useOfflinePage } from "../../offline/useOfflinePage";

export function OctaveLikedScreen() {
  const { t } = useTranslation("music");
  const player = usePagesPlayer();
  const nav = useOctaveNav();
  const { liked, natural, order, total, loading } = useLikedData();
  const tracks = useMemo(() => order.rows.map((r) => r.track), [order.rows]);
  const allTracks = useMemo(() => natural.map((r) => r.track), [natural]);
  const page = useOfflinePage({ data: natural.length > 0 || liked.data ? true : undefined, isPending: liked.isPending, isError: liked.isError }, [LIKED_COLLECTION_KEY]);
  const meta = useCountAndDuration(total, natural.reduce((s, r) => s + (r.track.durationMs ?? 0), 0));

  // Hors ligne sans la liste gardée : « Titres likés » gardés sur l'appareil, sinon « Pas disponible hors ligne ».
  if (page.view === "kept" || page.view === "offlineMissing") return <OfflinePageFallback keptKey={page.keptKey} />;
  if (liked.isError && natural.length === 0) return <ErrorState onRetry={() => void liked.refetch()} />;

  return (
    <ListPage
      title={t("liked.title")}
      contextId="liked"
      hero={(scrollY) => (
        <LikedHero
          scrollY={scrollY}
          meta={liked.isPending ? null : meta}
          canPlay={tracks.length > 0}
          onPlay={() => playFrom(player, tracks, 0, "liked")}
          onShuffle={() => player && queueActions.playShuffled(player, tracks, "liked")}
          extra={!loading && natural.length > 0 ? <KeepLikedButton tracks={allTracks} /> : null}
        />
      )}
      natural={natural}
      order={order}
      loading={loading}
      empty={<EmptyState icon={Heart} title={t("views.likedEmptyTitle")} hint={t("liked.empty")} action={<PillButton label={t("views.findMusic")} icon={Search} onPress={() => nav.search()} />} />}
    />
  );
}
