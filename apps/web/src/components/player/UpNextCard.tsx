/**
 * La fiche « à suivre » — la GRANDE SŒUR de la pilule de saut, pas un autre
 * objet.
 *
 * # Ce qui clochait
 *
 * Les deux surfaces paraissent au même moment, à trente pixels l'une de
 * l'autre, et elles ne parlaient pas la même langue. La pilule était passée au
 * sobre — aplat blanc, noir dessus, ombre neutre — quand la fiche gardait
 * l'ancien dessin : halo violet autour du cadre, barre de progression en
 * DÉGRADÉ de marque avec sa propre lueur de douze pixels, pastille lumineuse
 * dans le badge. Posée au-dessus d'une barre de lecture déjà violette, cette
 * accumulation ne hiérarchisait plus rien : trois accents de marque se
 * disputaient le même coin de l'écran.
 *
 * Pire, le temps restant s'affichait DEUX FOIS — la barre néon en haut, et une
 * pastille « 6sec » à côté du badge — sans que ni l'une ni l'autre ne soit à
 * l'endroit où l'on agit.
 *
 * # Ce qu'on fait
 *
 * Le bouton d'action EST la pilule : même aplat, même rayon plein, même voile
 * de survol, et surtout même façon de dire le temps — le balayage de
 * `overlayPill.tsx`, partagé au caractère près avec `SkipSegmentButton`. Le
 * décompte se lit donc là où se trouve le geste, une seule fois, et la barre
 * néon comme la pastille disparaissent. Le cadre, lui, redevient neutre : la
 * marque reste à la barre de lecture, dont c'est la place.
 *
 * Le décalage assumé du balayage : il court sur la durée ARMÉE depuis son
 * montage, sans se resynchroniser sur le chiffre. Sur dix secondes battues à
 * 250 ms, l'écart se compte en fractions de seconde — et c'est le prix d'une
 * transition unique et fluide plutôt que d'une transformée relancée quatre
 * fois par seconde (cf. l'avertissement de `Sweep`).
 *
 * PAS de `backdrop-filter` sur la carte. `--surface-modal` est à 0,96 d'alpha :
 * quatre pour cent de l'image passent au travers, flouter ou non n'y change
 * rien à l'œil. Le coût, lui, est bien réel — la carte flotte au-dessus d'une
 * vidéo EN LECTURE, dont l'arrière-plan change vingt-quatre à soixante fois par
 * seconde, et chaque changement force une recopie de la région et une passe de
 * flou. Même arbitrage que le panneau d'aperçu (cf. `theme/surfaces.css`).
 */

import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { videoShadow } from "../../lib/videoShadow";
import { Sweep, Veil } from "./overlayPill";

interface UpNextCardProps {
  /**
   * Secondes restantes avant l'enchaînement automatique, ou `null` quand il n'y
   * en a pas — la carte est alors une simple PROPOSITION, affichée dès le
   * générique : ni compte à rebours, ni balayage, puisqu'il n'y aurait rien à
   * mesurer. Elle prend la place du bouton « Épisode suivant » qu'on affichait
   * jusque-là.
   */
  countdown: number | null;
  /** Episode title (e.g. "Le piège du Major"). */
  episodeTitle?: string;
  /** Optional sub-label like "S03E08". */
  episodeLabel?: string;
  episodeDescription?: string;
  episodeImageUrl?: string;
  onPlay: () => void;
  onDismiss: () => void;
  /**
   * La barre de contrôles est-elle à l'écran ?
   *
   * Elle commande la POSITION, pas les refus : la carte monte au-dessus de la
   * barre de progression quand celle-ci paraît, et redescend en bas à droite
   * quand elle s'efface. Sans cela elle se posait en travers de la barre, qu'on
   * ne pouvait plus ni lire ni saisir. Même geste et même arrivée que la pilule
   * de saut — 104 px du bas dans les deux cas.
   */
  controlsVisible?: boolean;
  /** Initial countdown value used for progress (defaults to 10s). */
  totalSeconds?: number;
}

const DEFAULT_TOTAL = 10;

/**
 * L'ombre du cadre, sans marque.
 *
 * Le halo violet qui l'entourait (`0 0 32px` de brand, plus un liseré de marque
 * dans les DEUX branches) est ce qui la faisait sortir du lot. Il ne reste
 * qu'une ombre portée neutre — et, là où la surface a un canal alpha, le seul
 * liseré : un flou large y sort en aplat noir (cf. `lib/videoShadow.ts`).
 */
const CARD_SHADOW = videoShadow(
  "0 20px 50px rgba(0, 0, 0, 0.55)",
  "0 0 0 1px rgba(0, 0, 0, 0.35)",
);

/** L'entrée de la pilule, au même tempo : 200 ms, sortie plus vive que l'entrée. */
const EASE_OUT = [0, 0, 0.2, 1] as const;

export function UpNextCard({
  countdown,
  episodeTitle,
  episodeLabel,
  episodeDescription,
  episodeImageUrl,
  onPlay,
  onDismiss,
  controlsVisible = false,
  totalSeconds = DEFAULT_TOTAL,
}: UpNextCardProps) {
  const { t } = useTranslation("player");
  const counting = countdown !== null;

  return (
    <motion.div
      // Le même mouvement que la pilule — une montée de huit pixels et un
      // fondu, sur 200 ms. C'était un ressort avec changement d'échelle : deux
      // surfaces voisines qui entrent avec des physiques différentes se lisent
      // comme deux applications. La montée passe par `y` de framer et non par
      // une classe : les deux écriraient la même transformée, et la dernière
      // posée gagnerait.
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: controlsVisible ? -80 : 0 }}
      exit={{ opacity: 0, y: 8, transition: { duration: 0.16, ease: EASE_OUT } }}
      transition={{ duration: 0.2, ease: EASE_OUT }}
      className="absolute bottom-4 right-4 z-30 w-[min(420px,calc(100vw-2rem))] overflow-hidden sm:bottom-6 sm:right-6"
      onClick={(e) => { e.stopPropagation(); }}
      style={{
        background: "var(--surface-modal)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--radius-xl)",
        boxShadow: CARD_SHADOW,
      }}
    >
      {/* La vignette de l'épisode, fondue dans la surface pour que le texte
          reste lisible. Badge et croix sont posés SUR l'image : ils restent en
          dur (blanc, noirs translucides) quel que soit le thème. */}
      <div className="relative aspect-[16/7] w-full overflow-hidden">
        {episodeImageUrl ? (
          <img
            src={episodeImageUrl}
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
            draggable={false}
          />
        ) : (
          <div className="absolute inset-0" style={{ background: "var(--surface-1)" }} />
        )}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(15,15,21,0.55) 55%, var(--surface-modal) 100%)",
          }}
        />

        {/* Le badge dit CE QUE C'EST, et rien d'autre : le temps a rejoint le
            bouton. Sa pastille était en `--brand-light` avec une lueur de huit
            pixels — le troisième accent de marque du même coin d'écran ; elle
            est désormais blanche et mate.
            PAS de `backdrop-filter` : le fond est à 0,72 d'alpha, un flou n'y
            floute rien de visible — et il coûterait une recopie de région et
            une passe de flou PAR IMAGE, au-dessus d'une vidéo en lecture. */}
        <span
          className="absolute left-4 top-3 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.16em] text-white"
          style={{
            background: "rgba(0, 0, 0, 0.72)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            textShadow: "0 1px 3px rgba(0,0,0,0.85)",
          }}
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-white/90" />
          {t("player:upNext")}
        </span>

        {/* La croix — LE refus de la carte, désormais le seul. Le bouton texte
            « Masquer » disait la même chose une seconde fois, en occupant la
            moitié de la rangée d'actions.
            44 px de cible, comme la croix de la pilule de saut : les 32 px
            d'avant étaient sous le plancher tactile. La couleur seule change au
            survol — un fond animé repeindrait au-dessus de la vidéo. */}
        <button
          type="button"
          onClick={onDismiss}
          aria-label={t("player:dismiss")}
          title={t("player:dismiss")}
          className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full text-white/85 transition-colors duration-150 motion-reduce:transition-none hover:text-white"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Le texte et l'action — sous la vignette, sur le fond `surface-modal`
          de la carte (pas sur l'image) : tokenisé, suit le thème. */}
      <div className="px-5 pb-5 pt-1">
        {episodeLabel && (
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-content-tertiary">
            {episodeLabel}
          </p>
        )}
        {episodeTitle && (
          // DEUX lignes, plus une seule tronquée. Le titre porte souvent le
          // code d'épisode ET le nom de la série (« S04E04 — Re:Zero, Starting
          // Life in Another World »), que `truncate` coupait au tiers : la
          // carte annonçait un épisode sans dire lequel.
          <p className="mt-0.5 line-clamp-2 text-[15px] font-semibold leading-snug text-content-primary">
            {episodeTitle}
          </p>
        )}
        {episodeDescription && (
          <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-content-tertiary">
            {episodeDescription}
          </p>
        )}

        {/* LA pilule, à la lettre : même aplat, même rayon plein, même voile de
            survol, même balayage. Une seule action — le refus vit dans la
            croix, en haut à droite, là où on le cherche sur une carte.
            Le survol ne change plus l'échelle : un bouton pleine largeur qui
            grandit de deux pour cent sous un balayage en cours donnait deux
            mouvements concurrents, et la pilule, elle, n'a jamais fait ça. */}
        <button
          type="button"
          onClick={onPlay}
          className="group/play relative mt-4 flex min-h-11 w-full items-center justify-center overflow-hidden rounded-full border border-cta-primary-border bg-cta-primary-bg text-sm font-bold text-cta-primary-fg"
        >
          <Veil className="group-hover/play:opacity-100" />
          {/* AVANT le libellé, donc dessous : un élément positionné peint
              par-dessus le contenu de flux, et le texte doit rester net.
              La `key` suit la DURÉE armée, jamais les secondes — sans quoi le
              balayage repartirait de zéro à chaque battement. */}
          {counting && <Sweep key={String(totalSeconds)} durationMs={totalSeconds * 1000} />}
          <span className="relative flex items-center gap-2 tabular-nums">
            <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {counting
              ? t("player:playNowIn", { seconds: countdown })
              : t("player:playNow")}
          </span>
        </button>
      </div>
    </motion.div>
  );
}
