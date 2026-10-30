/**
 * Octave — la pastille « Fondu 5 s » du dock (bureau, web large) : l'état d'un coup d'œil, et au clic le
 * réglage de la transition douce (`CrossfadeDial`) dans une bulle au-dessus du dock. Un PORTAIL : sous le verre
 * du dock, un `fixed` prendrait son parent pour cadre (`modalPortal.test.ts`). Échap ou un clic ailleurs la
 * referme, le focus revient à la pastille.
 */

import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Blend } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLiquidGlassSurface } from "../../../../theme/glass";
import { useCrossfadeMs } from "../../../engine/crossfadeSetting";
import { CrossfadeDial } from "./CrossfadeDial";

const GAP = 12;

export const CrossfadeButton = memo(function CrossfadeButton() {
  const { t } = useTranslation("octaveShell");
  const ms = useCrossfadeMs();
  const on = ms > 0;
  const [open, setOpen] = useState(false);
  const anchor = useRef<HTMLButtonElement>(null);
  const label = on ? t("crossfade.chipOn", { count: ms / 1000 }) : t("crossfade.chipOff");
  const close = useCallback(() => {
    setOpen(false);
    anchor.current?.focus();
  }, []);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`${t("crossfade.label")} — ${label}`}
        title={label}
        onClick={() => setOpen((v) => !v)}
        data-crossfade-button
        className={`octave-dock-chip lg-bead relative flex h-9 shrink-0 cursor-pointer items-center gap-1 rounded-full px-2.5 text-xs font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-line-focus ${on ? "text-octave-accent-text" : "text-content-secondary hover:text-content-primary"}`}
      >
        <Blend className="h-[16px] w-[16px]" aria-hidden />
        <span>{on ? `${ms / 1000} s` : t("crossfade.off")}</span>
      </button>
      {open && <CrossfadeBubble anchor={anchor.current} onClose={close} />}
    </>
  );
});

function CrossfadeBubble({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  const { t } = useTranslation("octaveShell");
  const box = useRef<HTMLElement>(null);
  const [place, setPlace] = useState<{ right: number; bottom: number } | null>(null);
  const glass = useLiquidGlassSurface({
    material: "pane",
    tone: "dark",
    shape: "rounded",
    radius: "lg",
    className: "octave-night octave-stage-in fixed z-50 p-4 shadow-2xl",
    fallbackClassName: "octave-dock-fallback",
    style: place ?? undefined,
    ref: box,
  });

  useLayoutEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    setPlace({ right: Math.max(GAP, window.innerWidth - rect.right - 8), bottom: window.innerHeight - rect.top + GAP });
  }, [anchor]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (box.current?.contains(target) || anchor?.contains(target)) return;
      onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown, true);
    box.current?.querySelector<HTMLElement>("input,button")?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown, true);
    };
  }, [anchor, onClose]);

  if (place === null) return null;
  return createPortal(
    <div role="dialog" aria-label={t("crossfade.label")} {...glass.props}>
      {glass.layers}
      <div className="relative">
        <CrossfadeDial />
      </div>
    </div>,
    document.body,
  );
}
