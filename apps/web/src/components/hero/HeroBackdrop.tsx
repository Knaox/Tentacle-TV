import { AnimatePresence, motion } from "framer-motion";
import type { MediaItem } from "@tentacle-tv/shared";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { markImageSeen } from "../../lib/seenImages";
import { itemImageColor } from "../../lib/itemImageColor";
import { CROSSFADE, CROSSFADE_EXIT, ENTRY_FADE, useBillboardEntry } from "./useBillboardEntry";
import { useLoadedSlide } from "./useLoadedSlide";
import { HeroScrims } from "./HeroScrims";

interface HeroBackdropProps {
  item: MediaItem | undefined;
  /** L'image à montrer ; `null` : aucune — le fond de repli, jamais du noir. */
  url: string | null;
  /** L'image a échoué (404…) : la bannière passe à la suivante. */
  onFailure?: () => void;
}

/**
 * Hero backdrop synchronisé avec la rotation du carrousel :
 *  • Zoom doux scale(1) → scale(1.10) sur ~10s avec ease-out (cubic-bezier
 *    0.16,1,0.3,1) — la sensation "plus ça zoom plus c'est lent" vient de
 *    cette courbe : la vitesse perçue décroît continûment jusqu'à l'arrêt.
 *  • À la fin du zoom, HeroBillboard déclenche le slide suivant ; l'image
 *    sortante fade-out pendant que la nouvelle fade-in + recommence son
 *    propre zoom depuis scale(1). L'enchaînement infini donne l'impression
 *    d'un zoom continu sans coupure mécanique.
 *
 * Seul l'item actif est rendu (+ l'item sortant brièvement durant le fade),
 * via AnimatePresence — plus de stack de N <img> avec opacity à zéro.
 */
export const HERO_ZOOM_DURATION_S = 8;
/**
 * Le zoom — 1 → 1,06, linéaire, en huit secondes, bridé à trente paliers par
 * seconde — est la classe `hero-zoom` (`theme/heroMotion.css`), jouée par le
 * compositeur. Framer ne garde que le fondu enchaîné, qui a besoin
 * d'`AnimatePresence` pour faire sortir l'image précédente.
 *
 * `linear` exprès : un ease-out tassait 80 % du mouvement sur les trois
 * premières secondes, donnant l'illusion d'un zoom court — le reste de la durée
 * l'image paraissait figée.
 */
const ZOOM_CLASS = "hero-zoom";
/**
 * Le fondu enchaîné d'une diapositive à l'autre : UNE rampe continue, sur le compositeur — la
 * nouvelle image fond par-dessus l'ancienne, qui reste pleine dessous puis s'en va
 * (`CROSSFADE`, `CROSSFADE_EXIT` : `useBillboardEntry.ts`, où la règle est dite). Il a été
 * bridé à trente paliers par seconde : cela scintillait.
 */

/** Le décor d'une bannière sans image : deux lueurs de marque sur le fond de page. */
/** Le fond de repli : une encre de carte (refonte de nov. 2026 — plus de lavis au dégradé de marque). */
const FALLBACK_CLASS = "absolute inset-0 bg-surface-2";

export function HeroBackdrop({ item, url, onFailure }: HeroBackdropProps) {
  // URL résolue par la bannière (`homeHeroImageUrl`), partagée avec le halo et
  // la transition d'ouverture de fiche : celle-ci reprend donc un pixel DÉJÀ
  // décodé, sans un octet de plus. Une URL recalculée d'un côté ou de l'autre
  // (largeur ou qualité différente) suffirait à provoquer un second
  // chargement, donc un blanc.
  return <HeroBackdropLayer imageKey={item?.Id ?? null} url={url} onFailure={onFailure} tone={itemImageColor(item, "Backdrop")} />;
}

/**
 * La pile elle-même, pour une image déjà résolue : le bandeau de l'accueil
 * hors ligne la nourrit du décor posé sur le disque — mêmes fondus, même zoom,
 * mêmes voiles que l'accueil en ligne.
 */
export function HeroBackdropLayer({ imageKey: wantedKey, url: wantedUrl, onFailure, tone }: {
  /** Clé de la diapositive (`null` = aucune) : pilote le fondu enchaîné. */
  imageKey: string | null;
  url: string | null;
  /** Appelé quand l'image échoue, en plus de la masquer. */
  onFailure?: () => void;
  /** La couleur moyenne de l'image demandée (son blurhash) : ce que la bannière montre en l'attendant. */
  tone?: string | null;
}) {
  // La diapositive montrée est la dernière dont l'image est chargée : le fondu enchaîné ne part
  // jamais vers une image absente (cf. `useLoadedSlide`).
  const { key: imageKey, url } = useLoadedSlide(wantedKey, wantedUrl);
  // Calculée AVANT le retour anticipé : le suivi de l'échec est un hook, il ne
  // peut pas vivre après une sortie conditionnelle.
  const { broken, reportFailure } = useBrokenImage(url ?? undefined);
  // L'arrivée sur la page ne repart jamais du noir (cf. `useBillboardEntry`) ;
  // le fondu enchaîné d'une diapositive à l'autre reste tel quel.
  const entry = useBillboardEntry(imageKey, url);
  // Sous l'image : sa COULEUR d'abord (docs/REFONTE-UI.md, « Une image qui ne clignote pas »),
  // l'encre de carte sans elle. Une bannière dont l'image tarde garde la clarté de son image.
  const fallback = <div className={FALLBACK_CLASS} style={tone ? { backgroundColor: tone } : undefined} />;

  // Solid base + gradients restent rendus en permanence (jamais animés).
  //
  // La pile elle-même vit dans `HeroScrims`, partagée avec la bibliothèque et
  // la fiche média. Les trois pages posaient la même grammaire, recopiée trois
  // fois, et les trois copies avaient dérivé — chaque écart se payant ensuite
  // sur un téléviseur, où la même image ne rendait pas pareil selon la page
  // qui la portait. Les chaînes COMPLÈTES des jetons restent dans
  // `theme/scrims.css` et `theme/surfaces.css`.
  //
  // `h-[62%]` et non 55 % : la rampe de `--hero-scrim-bottom` a été adoucie
  // (quatre paliers) et a besoin de plus de course pour atteindre l'opacité
  // sans marche visible.
  //
  // PAS de raccord vers la page (`--hero-page-fade`). Il existait pour fondre
  // une bannière à FOND PERDU dans la page : la première rangée la chevauchait,
  // il fallait effacer la couture. La bannière est désormais encadrée — son
  // bord bas est un vrai bord, net, et plus rien ne la chevauche.
  const overlays = <HeroScrims bottom="h-[62%]" />;

  if (imageKey === null) {
    return (
      <>
        {fallback}
        {overlays}
      </>
    );
  }

  return (
    <>
      {/* Le fond de REPLI, sous l'image : un titre sans image (ou dont l'image
          a échoué) garde un fond d'encre, jamais un cadre noir. Statique —
          rien n'y est animé, il ne coûte qu'une peinture. */}
      {fallback}

      <AnimatePresence initial={entry.presenceInitial}>
        {url && (
          <motion.img
            key={imageKey}
            src={url}
            alt=""
            draggable={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={CROSSFADE_EXIT}
            // La première image de la bannière paraît en un temps d'affiche ; les suivantes fondent
            // sur l'image quittée, restée pleine dessous.
            transition={{ opacity: entry.isEntry ? ENTRY_FADE : CROSSFADE }}
            className={`absolute inset-0 h-full w-full object-cover will-change-transform ${ZOOM_CLASS}`}
            style={{ display: broken ? "none" : undefined }}
            onLoad={() => markImageSeen(url)}
            onError={() => {
              reportFailure();
              onFailure?.();
            }}
          />
        )}
      </AnimatePresence>

      {overlays}
    </>
  );
}
