import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Check, ChevronLeft, Languages, Maximize, Pause, RotateCcw, RotateCw, Volume2 } from "lucide-react";
import type { SceneProps } from "../../types";
import { useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, FauxCursor, Place, SceneStage, instant, sceneTween, useSceneClock } from "..";
import { FauxGlass } from "./FauxGlass";

/** Contrôles repliés, nés du transport, le pointeur vers « Pistes », l'appui, le panneau, la piste choisie. */
const STEPS = [900, 1500, 1100, 500, 1300, 2600] as const;
const ROW_Y = 300;
const ROW_H = 40;
/** Les petites formes du bas, séparées de 10 px — au-delà de la distance de fusion : elles restent distinctes. */
const TIME = { x: 40, w: 226 };
const SOUND = { x: 276, w: ROW_H };
const TRANSPORT = { x: 326, w: 120 };
const SETTINGS = { x: 456, w: 144 };
/** Le pivot du repli : le centre du transport, d'où naissent les formes (`useCollapsePivots` dans le lecteur). */
const PIVOT_X = TRANSPORT.x + TRANSPORT.w / 2;
const PANEL = { x: 416, y: 112, w: 184, h: 176 };
/** Voile média des bandes de contrôle (0,7 au bord : ≥ 6:1 pour un glyphe blanc, même sur une image blanche). */
const SCRIM_TOP = "linear-gradient(to bottom, rgba(var(--scrim-media-rgb), 0.7), rgba(var(--scrim-media-rgb), 0.55) 60%, transparent)";
const SCRIM_BOTTOM = "linear-gradient(to top, rgba(var(--scrim-media-rgb), 0.7), rgba(var(--scrim-media-rgb), 0.6) 55%, transparent)";
const PANEL_TINT = "rgba(var(--scrim-media-rgb), 0.62)";
/** Les pistes d'un film : des noms de langues, pas des mots de l'interface. */
const AUDIO = ["Français · 5.1", "English · Atmos"] as const;

const CURSOR = [
  { x: 320, y: 200 },
  { x: 320, y: 200 },
  { x: SETTINGS.x + 40, y: ROW_Y + 20 },
  { x: SETTINGS.x + 40, y: ROW_Y + 20 },
  { x: PANEL.x + 92, y: PANEL.y + 72 },
  { x: PANEL.x + 92, y: PANEL.y + 72 },
] as const;

/** Une forme du bas : repliée vers le pivot tant que les contrôles ne sont pas là. */
function folded(shown: boolean, x: number, w: number) {
  return { visible: shown, dx: shown ? 0 : PIVOT_X - (x + w / 2), scale: shown ? 1 : 0.2 };
}

/**
 * Le lecteur en Liquid Glass, tel que livré : sur la vraie image du titre du
 * bandeau, de PETITES formes de verre clair qui flottent séparées — la sortie
 * et le titre en haut ; le temps, le son, le transport, les réglages en bas —,
 * nées du transport comme d'une goutte qui se sépare. « Pistes » ouvre son
 * panneau de verre normal (une surface de texte) depuis le bouton, où une
 * autre piste audio se choisit. Aucune dalle, aucun voile noir.
 */
export function GlassPlayerScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["player"]);
  const { backdrop } = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const shown = step >= 1;
  const open = step >= 4;
  const picked = step >= 5 ? 1 : 0;
  const cursor = CURSOR[step];
  const row = { y: ROW_Y, h: ROW_H, onMedia: true, level: "clear" as const };

  return (
    <SceneStage cycle={cycle}>
      <Place x={0} y={0} w={640} h={360} className="overflow-hidden">
        {/* Le film : il dérive lentement, en transform seulement — c'est lui que le verre laisse voir. */}
        <motion.div
          className="absolute inset-0"
          initial={false}
          animate={{ scale: 1 + step * 0.01 }}
          transition={reduced ? instant : { duration: 1.4, ease: "linear" }}
        >
          {backdrop
            ? <img src={backdrop.url} alt="" draggable={false} className="h-full w-full object-cover" />
            : <div className="h-full w-full" style={{ background: CARD_TONES[1] }} />}
        </motion.div>
        {/* Les bandes du haut et du bas assombries, comme l'image d'un lecteur sous ses contrôles : les
            glyphes BLANCS du lecteur (halo compris) y tiennent l'AA sur n'importe quel film, même blanc
            — un décor de scène n'a ni mesure ni garantie de ton. Jamais DANS le verre. */}
        <div className="absolute inset-x-0 top-0 h-[84px]" style={{ background: SCRIM_TOP }} />
        <div className="absolute inset-x-0 bottom-0 h-[110px]" style={{ background: SCRIM_BOTTOM }} />
      </Place>
      <FauxGlass x={18} y={16} w={34} h={34} shape="circle" level="clear" onMedia visible={shown} className="flex items-center justify-center">
        <ChevronLeft size={18} strokeWidth={2.2} aria-hidden />
      </FauxGlass>
      <FauxGlass x={62} y={16} w={240} h={34} level="clear" onMedia visible={shown} className="flex items-center px-4">
        <span className="truncate text-[12px] font-semibold">{backdrop?.title ?? " "}</span>
      </FauxGlass>
      <FauxGlass {...row} x={TIME.x} w={TIME.w} {...folded(shown, TIME.x, TIME.w)} className="flex flex-col justify-center gap-1.5 px-4">
        <div className="h-[4px] overflow-hidden rounded-full bg-[rgba(var(--scrim-media-rgb),0.3)]">
          <motion.div
            className="h-full w-full origin-left rounded-full"
            style={{ background: "var(--progress-fill)" }}
            initial={false}
            animate={{ scaleX: 0.42 + step * 0.01 }}
            transition={reduced ? instant : sceneTween}
          />
        </div>
        <span className="flex justify-between text-[10px] font-semibold tabular-nums">
          <span>54:12</span>
          <span>-1:14:28</span>
        </span>
      </FauxGlass>
      <FauxGlass {...row} x={SOUND.x} w={SOUND.w} shape="circle" {...folded(shown, SOUND.x, SOUND.w)} className="flex items-center justify-center">
        <Volume2 size={15} aria-hidden />
      </FauxGlass>
      <FauxGlass {...row} x={TRANSPORT.x} w={TRANSPORT.w} {...folded(shown, TRANSPORT.x, TRANSPORT.w)} className="flex items-center justify-evenly">
        <RotateCcw size={14} aria-hidden />
        <Pause size={18} fill="currentColor" strokeWidth={0} aria-hidden />
        <RotateCw size={14} aria-hidden />
      </FauxGlass>
      <FauxGlass {...row} x={SETTINGS.x} w={SETTINGS.w} {...folded(shown, SETTINGS.x, SETTINGS.w)} className="flex items-center justify-evenly">
        <span className="flex items-center gap-1 text-[10px] font-semibold">
          <Languages size={14} aria-hidden />
          {t("player:tracks")}
        </span>
        <Maximize size={14} aria-hidden />
      </FauxGlass>
      {/* Le panneau naît du bouton : il grandit depuis son coin, en transform. Monté un pas avant son
          apparition seulement — un verre masqué par l'opacité coûterait encore (« Coût GPU »). */}
      {step >= 3 && <Place x={PANEL.x} y={PANEL.y} w={PANEL.w} h={PANEL.h} visible={open} scale={open ? 1 : 0.4}
        style={{ transformOrigin: "30% 100%" }} transition={reduced ? instant : undefined}>
        {/* Les panneaux du lecteur sont une « île sombre » (teinte native, `--lg-player-panel-tint`) aux
            libellés blancs : ici la même île, assez dense pour l'AA sur un film blanc. */}
        <FauxGlass x={0} y={0} w={PANEL.w} h={PANEL.h} shape="rounded" onMedia className="p-3" style={{ background: PANEL_TINT }}>
          <p className="text-[9px] font-bold tracking-[0.16em]" style={{ color: "var(--on-media-secondary)" }}>
            {t("player:audioLabel")}
          </p>
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
          <p className="mt-3 text-[9px] font-bold tracking-[0.16em]" style={{ color: "var(--on-media-secondary)" }}>
            {t("player:subtitlesLabel")}
          </p>
          <div className="mt-1.5 flex h-[26px] items-center px-2.5 text-[11px] font-semibold">{t("player:subtitlesDisabled")}</div>
        </FauxGlass>
      </Place>}
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 3 || step === 5} reduced={reduced} />
    </SceneStage>
  );
}
