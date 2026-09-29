import { useTranslation } from "react-i18next";
import { Heart, HeartHandshake, LogOut, Play, Undo2, X, type LucideIcon } from "lucide-react";
import type { ScenePoster } from "../../sceneMedia";
import { CARD_TONES } from "../FauxCard";
import { Place } from "../Place";
import { sceneTween } from "../sceneMotion";

const BRAND_GRADIENT = "linear-gradient(135deg, var(--brand), var(--brand-accent))";

/** Un membre, en initiale sur un rond (`WtAvatar` sans photo). */
export function FauxAvatar({ name, tone, size }: { name: string; tone: number; size: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-full font-bold text-white ring-2 ring-[var(--surface-1)]"
      style={{ width: size, height: size, fontSize: size * 0.42, background: CARD_TONES[tone % CARD_TONES.length] }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/**
 * L'en-tête de la pile (`AffinityHeader`) : ce qu'on swipe, « Quitter », et
 * chaque membre avec ce qu'il a jugé — jamais CE qu'il a aimé.
 */
export function FauxAffinityHeader({ x, y, w, friend, judged, visible }: {
  x: number; y: number; w: number; friend: string; judged: { you: number; friend: number }; visible: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  const members = [
    { name: t("affinityYou"), tone: 1, count: judged.you },
    { name: friend, tone: 3, count: judged.friend },
  ];
  return (
    <Place x={x} y={y} w={w} visible={visible} transition={sceneTween}>
      <div className="flex items-start gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl text-white" style={{ background: BRAND_GRADIENT }}>
          <HeartHandshake size={14} strokeWidth={2.2} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-semibold leading-tight text-content-primary">{t("affinityTitle")}</p>
          <p className="text-[9px] text-content-tertiary">
            {t("affinityKindMovie")} · {t("affinityDeckCount", { count: 24 })} · <span className="font-semibold text-[var(--brand-light)]">{t("affinityChange")}</span>
          </p>
        </div>
        <span className="inline-flex h-6 items-center gap-1 rounded-full border border-line-subtle bg-fill-soft px-2 text-[9px] font-semibold text-content-primary">
          <LogOut size={10} aria-hidden />
          {t("affinityQuit")}
        </span>
      </div>
      <div className="mt-2 flex gap-1.5">
        {members.map((m) => (
          <span key={m.name} className="inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-fill-faint py-0.5 pl-0.5 pr-2">
            <FauxAvatar name={m.name} tone={m.tone} size={16} />
            <span className="text-[9px] font-medium text-content-primary">{m.name}</span>
            <span className="text-[9px] tabular-nums text-content-tertiary">{t("affinityJudged", { count: m.count })}</span>
          </span>
        ))}
      </div>
    </Place>
  );
}

/** Les trois gestes de l'affinité (`SwipeControls` à deux verdicts) : pas pour moi · annuler · j'aime. */
export function FauxAffinityControls({ x, y, visible }: { x: number; y: number; visible: boolean }) {
  const { t } = useTranslation("swipe");
  const specs: ReadonlyArray<{ key: string; Icon: LucideIcon; lg: boolean; tone: string }> = [
    { key: "dislike", Icon: X, lg: true, tone: "text-rose-400" },
    { key: "undoShort", Icon: Undo2, lg: false, tone: "text-content-secondary" },
    { key: "like", Icon: Heart, lg: true, tone: "text-emerald-400" },
  ];
  return (
    <Place x={x} y={y} w={180} visible={visible} transition={sceneTween}>
      <div className="flex items-start justify-center">
        {specs.map(({ key, Icon, lg, tone }) => (
          <div key={key} className="flex w-[60px] flex-col items-center gap-1">
            <span className={`flex items-center justify-center rounded-full border border-line-subtle bg-surface-2 ${lg ? "h-10 w-10" : "h-8 w-8"} ${tone}`}>
              <Icon size={lg ? 18 : 14} strokeWidth={key === "dislike" ? 3 : 2.2} className={key === "like" ? "fill-current" : ""} />
            </span>
            <span className="whitespace-nowrap text-[8px] font-medium text-content-tertiary">{t(key)}</span>
          </div>
        ))}
      </div>
    </Place>
  );
}

/**
 * « C'est un match ! » (`AffinityMatchView`) : l'affiche et son cœur, le
 * titre en dégradé, qui aime, puis « Regarder ensemble » en tête.
 */
export function FauxAffinityMatch({ x, y, w, poster, friend, visible }: {
  x: number; y: number; w: number; poster: ScenePoster | null; friend: string; visible: boolean;
}) {
  const { t } = useTranslation("watchTogether");
  const title = poster?.title ?? "…";
  const meta = [poster?.year, t("affinityMovie")].filter(Boolean).join(" · ");
  return (
    <Place x={x} y={y} w={w} visible={visible} scale={visible ? 1 : 0.94} transition={sceneTween}>
      <div className="flex flex-col items-center text-center">
        <div className="relative w-[76px] -rotate-3">
          <span className="block aspect-[2/3] w-[76px] overflow-hidden rounded-xl shadow-[0_14px_30px_-10px_rgba(0,0,0,0.7)] ring-1 ring-white/10">
            {poster ? <img src={poster.url} alt="" draggable={false} className="h-full w-full object-cover" /> : <span className="block h-full w-full" style={{ background: CARD_TONES[0] }} />}
          </span>
          <span className="absolute -bottom-2 -right-2 grid h-7 w-7 place-items-center rounded-full text-white ring-[3px] ring-[var(--surface-1)]" style={{ background: BRAND_GRADIENT }}>
            <Heart size={13} fill="currentColor" aria-hidden />
          </span>
        </div>
        <p className="mt-3 bg-gradient-to-r from-[var(--brand)] to-[var(--brand-accent)] bg-clip-text text-[22px] font-extrabold tracking-tight text-transparent">
          {t("affinityMatchTitle")}
        </p>
        <p className="mt-0.5 max-w-[250px] text-[10px] leading-snug text-content-primary">{t("affinityMatchWithYou", { names: friend, title })}</p>
        <p className="text-[8px] text-content-tertiary">{meta}</p>
        <div className="mt-2 flex -space-x-1.5">
          <FauxAvatar name={t("affinityYou")} tone={1} size={20} />
          <FauxAvatar name={friend} tone={3} size={20} />
        </div>
        <span className="mt-3 inline-flex h-8 w-[200px] items-center justify-center gap-1.5 rounded-full border border-cta-primary-border bg-cta-primary-bg text-[11px] font-bold text-cta-primary-fg">
          <Play size={11} fill="currentColor" aria-hidden />
          {t("affinityWatchTogether")}
        </span>
        <span className="mt-1.5 inline-flex h-7 w-[200px] items-center justify-center rounded-full border border-line-subtle bg-fill-soft text-[10px] font-semibold text-content-primary">
          {t("affinityKeepSwiping")}
        </span>
      </div>
    </Place>
  );
}
