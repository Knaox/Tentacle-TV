import { AnimatePresence, cubicBezier, motion } from "framer-motion";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { JellyfinClient, RecoRowItem } from "@tentacle-tv/api-client";
import { HERO_ZOOM_DURATION_S } from "../../hero/HeroBackdrop";
import { HeroScrims } from "../../hero/HeroScrims";
import { HERO_BACKDROP_WIDTH } from "../../hero/resolveBackdrop";
import { AMBIENT_HZ, cadence } from "../../../theme/motion";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import { recoBackdropUrl } from "../recoImages";

// Miroir de HeroBackdrop pour un RecoRowItem (qui n'est pas un MediaItem) :
// mêmes durées, mêmes bridages de cadence — les commentaires de mesure vivent
// là-bas, ne pas faire dériver ces valeurs.
const FADE_DURATION_S = 1.2;
const TARGET_SCALE = 1.06;
const ZOOM_EASE = cadence(AMBIENT_HZ, HERO_ZOOM_DURATION_S);
const FADE_EASE = cadence(AMBIENT_HZ, FADE_DURATION_S, cubicBezier(0, 0, 0.58, 1));

/**
 * Fond d'une diapositive du carrousel de recommandations : backdrop TMDB
 * `w1280`, sinon backdrop Jellyfin. Un backdrop qui 404 (item de bibliothèque
 * sans image large) est masqué — l'aplat de page, les scrims et le halo
 * assurent le décor, jamais d'icône d'image cassée.
 */
/** L'URL EXACTE du fond affiché — la transition d'ouverture la réutilise
 *  telle quelle (cache HTTP), jamais recomposée. */
export function recoHeroBackdropUrl(client: JellyfinClient, item: RecoRowItem): string | null {
  return recoBackdropUrl(item, (id) =>
    client.getImageUrl(id, "Backdrop", { width: HERO_BACKDROP_WIDTH, quality: 85 })
  );
}

export function RecoHeroBackdrop({ item }: { item: RecoRowItem }) {
  const client = useJellyfinClient();
  const url = recoHeroBackdropUrl(client, item);
  const { broken, reportFailure } = useBrokenImage(url ?? undefined);

  return (
    <>
      <div className="absolute inset-0 bg-surface-0" />

      <AnimatePresence>
        {url && (
          <motion.img
            key={item.key}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0, scale: 1 }}
            animate={{ opacity: 1, scale: TARGET_SCALE }}
            exit={{ opacity: 0 }}
            transition={{
              opacity: { duration: FADE_DURATION_S, ease: FADE_EASE },
              scale: { duration: HERO_ZOOM_DURATION_S, ease: ZOOM_EASE },
            }}
            className="absolute inset-0 h-full w-full object-cover will-change-transform motion-reduce:!transform-none"
            style={{ display: broken ? "none" : undefined }}
            onError={reportFailure}
          />
        )}
      </AnimatePresence>

      <HeroScrims bottom="h-[62%]" />
    </>
  );
}
