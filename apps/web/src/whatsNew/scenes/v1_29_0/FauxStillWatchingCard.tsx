import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Hourglass, Pause } from "lucide-react";
import { easeOut } from "../../../theme/motion";
import { Place } from "../Place";
import { instant } from "../sceneMotion";

interface FauxStillWatchingCardProps {
  /** Le coin bas-droit du lecteur, en px logiques : la carte s'y pose par le bas. */
  right: number;
  bottom: number;
  w: number;
  /** `asking` : la question et son décompte ; `paused` : « Lecture en pause ». */
  phase: "hidden" | "asking" | "paused";
  /** Les secondes affichées pendant la question. */
  seconds: number;
  /** La part du décompte qui reste à la FIN du pas courant (0..1), et le temps pour y aller. */
  fraction: number;
  fractionS: number;
  /** La barre de contrôles est à l'écran : la carte monte au-dessus, de `lift` px. */
  lift: number;
  reduced: boolean;
}

/** La hauteur réservée au-dessus du coin : la carte est calée en bas de cette boîte. */
const BOX_H = 220;
/** L'entrée (fondu, montée de 8 px) et la montée au-dessus des contrôles, au tempo de l'encart réel. */
const SLIDE = { duration: 0.3, ease: easeOut } as const;

/**
 * L'encart « Vous regardez encore ? » du lecteur, en faux, au balisage de
 * `StillWatchingPrompt` (recopié : le vrai arme sa barre UNE fois sur le temps
 * réel, dix secondes, que la scène resserre) : la carte sombre presque opaque,
 * sans flou, le sablier puis la pause, le décompte en toutes lettres, la barre
 * en dégradé de marque qui se vide en `scaleX`, « Continuer » / « Mettre en
 * pause », puis « Reprendre ».
 */
export function FauxStillWatchingCard({
  right, bottom, w, phase, seconds, fraction, fractionS, lift, reduced,
}: FauxStillWatchingCardProps) {
  const { t } = useTranslation("player");
  const asking = phase !== "paused";
  const shown = phase !== "hidden";
  return (
    <Place
      x={right - w} y={bottom - BOX_H} w={w} h={BOX_H} className="z-10 flex flex-col justify-end"
      visible={shown} dy={shown ? -lift : 8} transition={reduced ? instant : SLIDE}
    >
      <div className="overflow-hidden rounded-2xl border border-white/10 bg-[rgba(16,14,24,0.96)] p-3.5 text-white shadow-[0_12px_40px_rgba(0,0,0,0.5)] ring-1 ring-black/20">
        <div className="flex items-start gap-2.5">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[rgba(var(--brand-rgb),0.18)] text-[var(--brand-light)]">
            {asking ? <Hourglass size={13} strokeWidth={2.2} /> : <Pause size={13} strokeWidth={2.2} />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold leading-snug">
              {asking ? t("stillWatching.title") : t("stillWatching.pausedTitle")}
            </p>
            <p className="mt-0.5 text-[10px] leading-relaxed text-white/70">
              {asking ? t("stillWatching.countdown", { count: seconds }) : t("stillWatching.pausedBody")}
            </p>
          </div>
        </div>
        {asking && (
          <div className="mt-3 h-[3px] overflow-hidden rounded-full bg-white/10">
            <motion.div
              className="h-full origin-left rounded-full bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)]"
              initial={false}
              animate={{ scaleX: fraction }}
              transition={reduced ? instant : { duration: fractionS, ease: "linear" }}
            />
          </div>
        )}
        <div className={`flex gap-1.5 ${asking ? "mt-3" : "mt-3.5"}`}>
          {asking ? (
            <>
              <CardButton primary label={t("stillWatching.continue")} />
              <CardButton label={t("stillWatching.pause")} />
            </>
          ) : (
            <CardButton primary label={t("stillWatching.resume")} />
          )}
        </div>
      </div>
    </Place>
  );
}

function CardButton({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <span
      className={`flex h-[28px] flex-1 items-center justify-center whitespace-nowrap rounded-full px-2 text-[10px] ${
        primary
          ? "bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] font-semibold text-white"
          : "border border-white/15 font-medium text-white/85"
      }`}
    >
      {label}
    </span>
  );
}
