import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { GalleryHorizontalEnd, Heart, Sparkles, Star, X } from "lucide-react";
import { Place } from "../Place";
import { sceneSpring, sceneTween } from "../sceneMotion";

const SEGMENT_W = 100;

/**
 * « Pour vous · Affiner » (`RecoSectionSwitch`) : une pilule opaque, le repère
 * au dégradé de marque glisse d'une section à l'autre en `transform`.
 */
export function FauxRecoSwitch({ x, y, refine }: { x: number; y: number; refine: boolean }) {
  const { t } = useTranslation("swipe");
  const sections = [
    { key: "forYou", label: t("sectionForYou"), Icon: Sparkles },
    { key: "refine", label: t("sectionRefine"), Icon: GalleryHorizontalEnd },
  ] as const;
  return (
    <Place x={x} y={y} w={SEGMENT_W * 2 + 6}>
      <div className="relative flex rounded-full bg-[color:var(--surface-2)] p-[3px] ring-1 ring-line-strong">
        <motion.span
          className="absolute left-[3px] top-[3px] h-[26px] rounded-full"
          style={{
            width: SEGMENT_W,
            background: "linear-gradient(135deg, rgba(var(--brand-rgb),0.95), rgba(var(--brand-accent-rgb),0.9))",
            boxShadow: "0 2px 10px rgba(var(--brand-rgb),0.35)",
          }}
          initial={false}
          animate={{ x: refine ? SEGMENT_W : 0 }}
          transition={sceneSpring}
        />
        {sections.map(({ key, label, Icon }) => {
          const selected = (key === "refine") === refine;
          return (
            <span key={key} className={`relative flex h-[26px] items-center justify-center gap-1 text-[11px] font-semibold ${selected ? "text-cta-brand-fg" : "text-content-secondary"}`} style={{ width: SEGMENT_W }}>
              <Icon size={12} />
              {label}
            </span>
          );
        })}
      </div>
    </Place>
  );
}

/** L'en-tête de la section (`SwipeHeader`) : le mode d'emploi, puis les compteurs de jugements. */
export function FauxSwipeHeader({ visible, like, superlike, dislike }: { visible: boolean; like: number; superlike: number; dislike: number }) {
  const { t } = useTranslation("swipe");
  const chips = [
    { key: "like", Icon: Heart, n: like, tone: "text-emerald-400 fill-current" },
    { key: "super", Icon: Star, n: superlike, tone: "text-fuchsia-300 fill-current" },
    { key: "dislike", Icon: X, n: dislike, tone: "text-rose-400" },
  ];
  return (
    <Place x={40} y={48} w={560} visible={visible} transition={sceneTween}>
      <div className="flex items-center justify-between gap-3">
        <p className="min-w-0 truncate text-[9px] text-content-secondary">{t("subtitle")}</p>
        <ul className="flex shrink-0 gap-1">
          {chips.map(({ key, Icon, n, tone }) => (
            <li key={key} className="inline-flex items-center gap-1 rounded-full border border-line-subtle bg-fill-subtle px-2 py-0.5 text-[10px] font-semibold tabular-nums text-content-primary">
              <Icon size={10} className={tone} />
              {n}
            </li>
          ))}
        </ul>
      </div>
    </Place>
  );
}

/** L'aide-mémoire des raccourcis (`SwipeShortcutsLegend`) ; `lit` allume la touche qu'on presse. */
export function FauxShortcutsLegend({ visible, lit }: { visible: boolean; lit: string | null }) {
  const { t } = useTranslation("swipe");
  const keys: Array<[string, string]> = [["←", t("keyLeft")], ["→", t("keyRight")], ["↑", t("keyUp")], ["↓", t("keyDown")], ["Z", t("keyUndo")]];
  return (
    <Place x={0} y={340} w={640} visible={visible} transition={sceneTween}>
      <ul className="flex justify-center gap-3 text-[8px] text-content-tertiary">
        {keys.map(([key, label]) => (
          <li key={key} className="inline-flex items-center gap-1">
            <kbd className="relative min-w-[16px] rounded border border-line-subtle bg-fill-subtle px-1 text-center font-sans text-[8px] font-semibold text-content-secondary">
              <motion.span
                className="absolute -inset-px rounded ring-2 ring-[var(--brand-light)]"
                initial={false}
                animate={{ opacity: lit === key ? 1 : 0, scale: lit === key ? 1.15 : 1 }}
                transition={sceneTween}
              />
              {key}
            </kbd>
            {label}
          </li>
        ))}
      </ul>
    </Place>
  );
}
