import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Languages, Maximize, Pause, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import type { SceneProps } from "../../types";
import { useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, FauxCursor, Place, SceneStage, instant, sceneTween, useSceneClock } from "..";
import { FauxGlass } from "./FauxGlass";

/** Les contrôles posés, le pointeur qui longe la barre, « Pistes », le panneau en verre, la piste choisie. */
const STEPS = [1500, 1300, 600, 1300, 2600] as const;
const BAR = { x: 70, y: 292, w: 500, h: 50 };
const TRACKS_BTN = { x: BAR.x + BAR.w - 92, y: BAR.y + 13 };
const PANEL = { x: 382, y: 92, w: 188, h: 186 };
/** Les pistes d'un film : des noms de langues, pas des mots de l'interface. */
const AUDIO = ["Français · 5.1", "English · Atmos"] as const;

/** Où se trouve le pointeur à chaque pas. Le verre du lecteur est NATIF : son reflet ne suit pas le pointeur. */
const CURSOR = [
  { x: 320, y: 220 },
  { x: BAR.x + 120, y: BAR.y + 24 },
  { x: TRACKS_BTN.x + 8, y: TRACKS_BTN.y + 10 },
  { x: PANEL.x + 90, y: PANEL.y + 72 },
  { x: PANEL.x + 90, y: PANEL.y + 72 },
] as const;

/**
 * Le lecteur en Liquid Glass : sur la vraie image du titre du bandeau, les
 * commandes flottent dans des capsules de verre CLAIR, presque neutre — le film
 * passe dessous et se devine au travers, comme dans le lecteur —, et « Pistes »
 * ouvre son panneau de verre depuis le bouton, où une autre piste audio se
 * choisit.
 */
export function GlassPlayerScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["player"]);
  const { backdrop } = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const open = step >= 3;
  const picked = step >= 4 ? 1 : 0;
  const cursor = CURSOR[step];

  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={360} className="overflow-hidden">
        {/* Le film : il dérive lentement, en transform seulement — c'est lui que le verre laisse deviner. */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ scale: 1 + step * 0.012 }}
          transition={reduced ? instant : { duration: 1.4, ease: "linear" }}
        >
          {backdrop
            ? <img src={backdrop.url} alt="" draggable={false} className="h-full w-full object-cover" />
            : <div className="h-full w-full" style={{ background: CARD_TONES[1] }} />}
        </motion.div>
      </Place>
      <FauxGlass x={18} y={16} w={34} h={34} level="clear" reduced={reduced} className="flex items-center justify-center text-white">
        <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
      </FauxGlass>
      <FauxGlass x={60} y={16} w={260} h={34} level="clear" reduced={reduced} className="flex items-center px-4">
        <span className="truncate text-[12px] font-semibold text-white">{backdrop?.title ?? " "}</span>
      </FauxGlass>
      <FauxGlass {...BAR} level="clear" radius={22} reduced={reduced} className="px-4 pt-2 text-white">
        <div className="h-[4px] overflow-hidden rounded-full bg-white/25">
          <motion.div
            className="h-full w-full origin-left rounded-full"
            style={{ background: "var(--progress-fill)" }}
            initial={false}
            animate={{ scaleX: 0.42 + step * 0.01 }}
            transition={reduced ? instant : sceneTween}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-center gap-3">
            <RotateCcw size={13} aria-hidden />
            <Pause size={16} fill="currentColor" strokeWidth={0} aria-hidden />
            <RotateCw size={13} aria-hidden />
            <Volume2 size={13} aria-hidden />
            <span className="text-[10px] tabular-nums text-white/75">54:12 / 2:08:40</span>
          </span>
          <span className="flex items-center gap-3">
            <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${open ? "bg-white/25" : ""}`}>
              <Languages size={12} aria-hidden />
              {t("player:tracks")}
            </span>
            <Maximize size={13} aria-hidden />
          </span>
        </div>
      </FauxGlass>
      {/* Le panneau naît du bouton : il grandit depuis son coin, en transform. */}
      <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} visible={open} scale={open ? 1 : 0.6}
        style={{ transformOrigin: "85% 100%" }} transition={reduced ? instant : undefined}>
        <FauxGlass x={0} y={0} w={PANEL.w} h={PANEL.h} level="clear" radius={20} reduced={reduced} className="p-3 text-white">
          <p className="text-[9px] font-bold tracking-[0.16em] text-white/70">{t("player:audioLabel")}</p>
          {AUDIO.map((label, i) => (
            <div key={label} className="relative mt-1.5 flex h-[26px] items-center justify-between rounded-xl px-2.5 text-[11px] font-semibold">
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-xl"
                style={{ background: "var(--lg-tinted-fill)" }}
                initial={false}
                animate={{ opacity: picked === i ? 1 : 0 }}
                transition={reduced ? instant : sceneTween}
              />
              <span className="relative">{label}</span>
              {picked === i && <Check size={12} className="relative" aria-hidden />}
            </div>
          ))}
          <p className="mt-3 text-[9px] font-bold tracking-[0.16em] text-white/70">{t("player:subtitlesLabel")}</p>
          <div className="mt-1.5 flex h-[26px] items-center rounded-xl bg-white/10 px-2.5 text-[11px] font-semibold">
            {t("player:subtitlesDisabled")}
          </div>
        </FauxGlass>
      </Place>
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 2 || step === 4} reduced={reduced} />
    </SceneStage>
  );
}
