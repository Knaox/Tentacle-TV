import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bell, Search } from "lucide-react";
import type { SceneProps } from "../../types";
import { posterAt, useSceneMedia } from "../../sceneMedia";
import { CARD_TONES, FauxCard, FauxCursor, Place, SceneStage, instant, sceneSpring, useSceneClock } from "..";
import { FauxGlass } from "./FauxGlass";

/** L'accueil au repos, la page qui défile SOUS la barre, le pointeur sur « Pour vous », la lentille qui y glisse. */
const STEPS = [1500, 1500, 1100, 700, 2400] as const;
/** La barre en GROUPES qui flottent, à 10 px (`--lg-chrome-group-gap`) : onglets, recherche, actions. */
const BAR_Y = 14;
const BAR_H = 38;
const TAB_W = 92;
const TABS_X = 6;
const TABS = { x: 150, w: TABS_X * 2 + TAB_W * 3 };
const SEARCH = { x: TABS.x + TABS.w + 10, w: BAR_H };
const ACTIONS = { x: SEARCH.x + SEARCH.w + 10, w: 80 };
const SCROLL = -118;
const CARD_W = 78;
const CARD_PITCH = 90;
/** Les feux de la fenêtre macOS : un dessin du système, à ses couleurs. */
const LIGHTS = ["#ff5f57", "#febc2e", "#28c840"] as const;

/**
 * La navigation en Liquid Glass, telle que livrée : la barre en GROUPES de
 * verre qui flottent (onglets, recherche, actions) au-dessus de la page, qui
 * défile DESSOUS — courbée au bord de chaque verre par la lentille, glyphes au
 * ton de ce qui passe dessous (`data-lg-tone`) ; un clic sur « Pour vous » et
 * la lentille teintée de l'onglet courant y glisse, comme une goutte. De vraies
 * affiches et le vrai décor du bandeau (sceneMedia), les vrais mots de la barre.
 */
export function GlassNavigationScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation(["nav"]);
  const media = useSceneMedia();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const scrolled = step >= 1;
  const tab = step >= 3 ? 1 : 0;
  const tabs = [t("nav:home"), t("nav:forYou"), t("nav:myList")];
  const cursor = step >= 2
    ? { x: TABS.x + TABS_X + TAB_W * 1.5, y: BAR_Y + 22 }
    : { x: 470, y: 250 };
  const move = reduced ? instant : sceneSpring;

  return (
    <SceneStage cycle={cycle}>
      {/* La page : le bandeau puis une rangée, qui montent ensemble sous la barre (transform seulement). */}
      <motion.div className="absolute inset-0" initial={false} animate={{ y: scrolled ? SCROLL : 0 }} transition={move}>
        <Place x={0} y={0} w={640} h={230} className="overflow-hidden">
          {media.backdrop
            ? <img src={media.backdrop.url} alt="" draggable={false} className="h-full w-full object-cover" />
            : <div className="h-full w-full" style={{ background: CARD_TONES[0] }} />}
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface-0)] via-transparent to-transparent" />
          <p className="absolute bottom-6 left-6 max-w-[360px] truncate text-[22px] font-bold text-on-media-primary">{media.backdrop?.title ?? " "}</p>
        </Place>
        {Array.from({ length: 7 }, (_, i) => (
          <FauxCard key={i} x={24 + i * CARD_PITCH} y={246} w={CARD_W} poster={posterAt(media, i)} tone={i} />
        ))}
        {Array.from({ length: 7 }, (_, i) => (
          <FauxCard key={`b${i}`} x={24 + i * CARD_PITCH} y={378} w={CARD_W} poster={posterAt(media, i + 7)} tone={i + 2} />
        ))}
      </motion.div>
      <Place x={20} y={28} className="flex gap-[7px]">
        {LIGHTS.map((color) => <span key={color} className="h-[11px] w-[11px] rounded-full" style={{ background: color }} />)}
      </Place>
      <FauxGlass x={TABS.x} y={BAR_Y} w={TABS.w} h={BAR_H}>
        {/* L'onglet courant : la lentille teintée de la marque, celle de la barre (`--lg-chrome-lens-*`), qui glisse. */}
        <motion.span
          aria-hidden
          className="absolute top-[5px] h-[28px] rounded-full"
          style={{
            left: TABS_X,
            width: TAB_W,
            background: "var(--lg-chrome-lens-bg, rgba(var(--brand-rgb), 0.4))",
            boxShadow: "var(--lg-chrome-lens-shadow, none)",
          }}
          initial={false}
          animate={{ x: tab * TAB_W, scaleX: step === 3 ? 1.12 : 1 }}
          transition={move}
        />
        <span className="absolute inset-y-0 flex items-center" style={{ left: TABS_X }}>
          {tabs.map((label, i) => (
            <span key={label} className={`flex justify-center text-[11px] ${i === tab ? "font-bold" : "font-semibold"}`} style={{ width: TAB_W }}>
              {label}
            </span>
          ))}
        </span>
      </FauxGlass>
      <FauxGlass x={SEARCH.x} y={BAR_Y} w={SEARCH.w} h={BAR_H} shape="circle" className="flex items-center justify-center">
        <Search size={14} aria-hidden />
      </FauxGlass>
      <FauxGlass x={ACTIONS.x} y={BAR_Y} w={ACTIONS.w} h={BAR_H} className="flex items-center justify-evenly">
        <Bell size={14} aria-hidden />
        <span aria-hidden className="h-[26px] w-[26px] rounded-full" style={{ background: CARD_TONES[0] }} />
      </FauxGlass>
      <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 3} reduced={reduced} />
    </SceneStage>
  );
}
