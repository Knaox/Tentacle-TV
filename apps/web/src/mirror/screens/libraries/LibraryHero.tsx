import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Film, Layers, Tv, type LucideIcon } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { LibraryView } from "@tentacle-tv/shared";
import { useInViewport } from "../../../hooks/useInViewport";
import { noMotion } from "../../../theme/motion";
import { useThemeMode } from "../../../theme/useThemeMode";
import { HEADER_TOTAL } from "../../shell/metrics";

/** Hauteur visible du héros, sous l'en-tête flottant (`LIBRARY_HERO_HEIGHT`). */
export const LIBRARY_HERO_HEIGHT = 230;
/** Une autre image de la bibliothèque toutes les douze secondes, en fondu de 900 ms. */
const ROTATE_MS = 12_000;
const CROSSFADE_MS = 900;

interface RandomItem {
  id: string;
  hasBackdrop: boolean;
  hasPrimary: boolean;
}

/** L'icône d'un type de bibliothèque (`collectionIcon` de l'app : film, tv, layers). */
export function collectionIcon(type?: string): LucideIcon {
  switch (type?.toLowerCase()) {
    case "movies": return Film;
    case "tvshows": return Tv;
    default: return Layers;
  }
}

/** Le voile qui fond l'image dans la page : 55 %, 15 %, 70 %, plein, aux arrêts 0 / 35 / 72 / 100 %. */
const VEIL =
  "linear-gradient(180deg, color-mix(in srgb, var(--surface-0) 55%, transparent) 0%, " +
  "color-mix(in srgb, var(--surface-0) 15%, transparent) 35%, " +
  "color-mix(in srgb, var(--surface-0) 70%, transparent) 72%, var(--surface-0) 100%)";

/**
 * L'ambiance d'une bibliothèque (`library/LibraryHero` de l'app) : une de ses
 * images, pleine largeur, qui passe SOUS l'en-tête de verre (elle remonte de
 * sa hauteur) et se fond dans la page — et son nom en grand : surtitre 11
 * gras capitales `brand.light` avec l'icône 12, titre 40/46 extra-gras
 * (-1), compte 14 semi-gras secondaire. Hauteur 230, texte à 16 du bas.
 *
 * L'image tourne lentement tant que le héros est à l'écran, la fenêtre
 * devant et le mouvement permis ; elle passe en fondu d'opacité.
 */
export const LibraryHero = memo(function LibraryHero({ library }: { library: LibraryView }) {
  const { t } = useTranslation("common");
  const { t: tn } = useTranslation("nav");
  const client = useJellyfinClient();
  const { isDark } = useThemeMode();
  const { ref, visible } = useInViewport<HTMLDivElement>();
  const items: RandomItem[] = (library as LibraryView & { _randomItems?: RandomItem[] })._randomItems ?? [];
  const [turn, setTurn] = useState(0);

  useEffect(() => {
    if (items.length <= 1 || !visible || noMotion()) return;
    const timer = setInterval(() => setTurn((n) => n + 1), ROTATE_MS);
    return () => clearInterval(timer);
  }, [items.length, visible]);

  const item = items.length > 0 ? items[turn % items.length] : undefined;
  const url = item?.hasBackdrop
    ? client.getImageUrl(item.id, "Backdrop", { width: 1280, quality: 75, index: 0 })
    : item?.hasPrimary ? client.getImageUrl(item.id, "Primary", { width: 900, quality: 75 }) : null;
  const count = library.RecursiveItemCount ?? library.ChildCount;
  const Icon = collectionIcon(library.CollectionType);

  return (
    <div ref={ref} className="relative flex flex-col justify-end pb-4" style={{ height: LIBRARY_HERO_HEIGHT }}>
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden"
        style={{ top: `calc(-1 * ${HEADER_TOTAL})` }}
        aria-hidden
      >
        <CrossfadeImage url={url} />
        <div className="absolute inset-0" style={{ background: VEIL }} />
      </div>
      <div className="relative flex flex-col gap-0.5 px-4">
        <div className="flex items-center gap-1.5">
          <Icon size={12} className="text-brand-light" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[1.2px] text-brand-light">{tn("library")}</span>
        </div>
        <h1
          className="truncate text-[40px] font-extrabold leading-[46px] tracking-[-1px] text-content-primary"
          style={{ textShadow: isDark ? "0 2px 12px rgba(0, 0, 0, 0.35)" : "none" }}
        >
          {library.Name}
        </h1>
        {count !== undefined && (
          <p className="text-sm font-semibold tabular-nums text-content-secondary">{t("libraryTitles", { count })}</p>
        )}
      </div>
    </div>
  );
});

/**
 * Deux calques au plus : l'image affichée, et la suivante qui monte en
 * opacité une fois chargée (`transition` d'expo-image). Seule l'opacité
 * s'anime ; le calque du dessous s'efface à la fin du fondu.
 */
function CrossfadeImage({ url }: { url: string | null }) {
  const [shown, setShown] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  useEffect(() => {
    if (loaded === null || loaded !== url || loaded === shown) return;
    const timer = setTimeout(() => setShown(loaded), noMotion() ? 0 : CROSSFADE_MS);
    return () => clearTimeout(timer);
  }, [loaded, url, shown]);

  return (
    <>
      {shown && shown !== url && (
        <img src={shown} alt="" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      )}
      {url && (
        <img
          key={url}
          src={url}
          alt=""
          draggable={false}
          decoding="async"
          onLoad={() => setLoaded(url)}
          className="absolute inset-0 h-full w-full object-cover"
          style={{
            opacity: loaded === url ? 1 : 0,
            transition: noMotion() ? "none" : `opacity ${CROSSFADE_MS}ms ease-out`,
          }}
        />
      )}
    </>
  );
}
