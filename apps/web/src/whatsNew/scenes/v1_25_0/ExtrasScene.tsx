import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { FauxCursor, Place, SceneStage, sceneTween, useSceneClock } from "..";
import { CARD_TONES } from "../FauxCard";

const STEPS = [1500, 1000, 400, 1700] as const;
const ROW = { x: 40, y: 206, w: 128, gap: 16 } as const;
const HOVERED = 1;
const POSTER_OFFSET = 4;

/**
 * Les extras de la fiche, sur un seul modèle : la bande-annonce du titre, celle
 * d'une saison, les bonus et les bandes-annonces gardées sur le serveur —
 * chacun avec son genre en sous-titre, jamais répété quand il est déjà le nom.
 * Le curseur survole la bande-annonce de la saison 2 : le halo de lecture.
 */
export function ExtrasScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["common", "whatsNew"]);
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const media = useSceneMedia();
  // Les extras sont ceux du titre du bandeau : ses propres décors, pas l'affiche d'un autre film.
  const gallery = media.detail?.gallery ?? [];
  const backdrop = gallery[0] ?? media.backdrop?.url ?? null;
  const thumbAt = (i: number) => (gallery.length > 0 ? gallery[(i + 1) % gallery.length] : posterAt(media, POSTER_OFFSET + i)?.backdropUrl ?? null);
  const tiles = [
    { label: t("common:trailer"), sublabel: null },
    { label: t("whatsNew:sceneSeason", { number: 2 }), sublabel: t("common:extraKindTrailer") },
    { label: t("common:extraKindBehindTheScenes"), sublabel: null },
    { label: t("common:extraNumbered", { kind: t("common:extraKindDeletedScene"), number: 2 }), sublabel: t("common:extraKindDeletedScene") },
  ];
  const hovered = step >= 1;
  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={200}>
        {backdrop ? <img src={backdrop} alt="" draggable={false} className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: CARD_TONES[1] }} />}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[rgba(0,0,0,0.15)] to-[var(--surface-0)]" />
      </Place>
      {media.detail?.logoUrl && (
        <Place x={40} y={70} w={220} h={80}>
          <img src={media.detail.logoUrl} alt="" draggable={false} className="h-full w-full object-contain object-left-bottom" />
        </Place>
      )}
      <Place x={ROW.x} y={ROW.y - 26} w={400}>
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-4 w-[3px] rounded-full" style={{ background: "linear-gradient(180deg, var(--brand), var(--brand-accent))" }} />
          <p className="text-[14px] font-bold tracking-tight text-content-primary">{t("common:extras")}</p>
        </div>
      </Place>
      {tiles.map((tile, i) => (
        <Place key={i} x={ROW.x + i * (ROW.w + ROW.gap)} y={ROW.y} w={ROW.w} visible transition={sceneTween}>
          <FauxExtraTile image={thumbAt(i)} tone={i} label={tile.label} sublabel={tile.sublabel} hovered={hovered && i === HOVERED} />
        </Place>
      ))}
      <FauxCursor
        x={ROW.x + HOVERED * (ROW.w + ROW.gap) + ROW.w / 2 + 6}
        y={ROW.y + 40}
        pressed={step === 2}
        hidden={step === 0}
        reduced={reduced}
      />
    </SceneStage>
  );
}

/** La tuile d'un extra (`ExtraTile`) : la vignette 16:9, son halo de lecture au survol, le titre et le genre. */
function FauxExtraTile({ image, tone, label, sublabel, hovered }: {
  image: string | null; tone: number; label: string; sublabel: string | null; hovered: boolean;
}) {
  return (
    <div className="flex flex-col">
      <motion.div
        className="relative aspect-video overflow-hidden rounded-md bg-surface-2"
        initial={false}
        animate={{ scale: hovered ? 1.03 : 1 }}
        transition={sceneTween}
      >
        {image ? <img src={image} alt="" draggable={false} className="h-full w-full object-cover" /> : <div className="h-full w-full" style={{ background: CARD_TONES[tone % CARD_TONES.length] }} />}
        <motion.div
          className="absolute inset-0 flex items-center justify-center bg-black/35 text-white"
          initial={false}
          animate={{ opacity: hovered ? 1 : 0 }}
          transition={sceneTween}
        >
          <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden><path d="M8 5v14l11-7z" /></svg>
        </motion.div>
      </motion.div>
      <p className="mt-1.5 truncate text-[11px] font-medium text-content-primary">{label}</p>
      {sublabel && <p className="truncate text-[9px] text-content-quaternary">{sublabel}</p>}
    </div>
  );
}
