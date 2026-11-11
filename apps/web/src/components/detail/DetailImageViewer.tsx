import { CaretLeftIcon } from "@phosphor-icons/react/dist/csr/CaretLeft";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";
import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useJellyfinClient, type JellyfinClient } from "@tentacle-tv/api-client";
import type { DetailImageRef } from "@tentacle-tv/shared";
import { easeOut, duration, exitDuration } from "../../theme/motion";
import { swipeDelta, useImageViewerControls } from "./useImageViewerControls";
import { lastInputWasKeyboard } from "../../lib/inputModality";
import { GlassButton } from "../ui/glass/GlassButton";

interface DetailImageViewerProps {
  title: string;
  gallery: DetailImageRef[];
  /** Image affichée ; `null` = fermée. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

const KIND_KEY = { backdrop: "media:imageKindBackdrop", poster: "media:imageKindPoster", still: "media:imageKindStill" } as const;

function fullUrl(client: JellyfinClient, ref: DetailImageRef): string {
  // Pleine définition : c'est l'unique raison d'ouvrir cette vue. Un décor en
  // 2560 de large, une affiche en 1800 de haut — Jellyfin ne suréchantillonne
  // jamais au-delà de l'original.
  const size = ref.aspect >= 1 ? { width: 2560 } : { height: 1800 };
  return client.getImageUrl(ref.itemId, ref.imageType, { ...size, quality: 92, tag: ref.tag, index: ref.index });
}

function thumbUrl(client: JellyfinClient, ref: DetailImageRef): string {
  return client.getImageUrl(ref.itemId, ref.imageType, { height: 120, quality: 80, tag: ref.tag, index: ref.index });
}

/**
 * La vue « image plein écran » de la fiche : décors, affiche, image d'un
 * épisode, en grand et en entier (`contain`), sur un noir presque plein.
 *
 * Pas de flou d'arrière-plan : à 95 % de noir, un `backdrop-filter` ne
 * montrerait rien et recopierait tout l'écran à chaque image. L'entrée est un
 * fondu + un léger zoom (opacité, `transform`) ; passer d'une image à l'autre
 * est un fondu enchaîné. Clavier (Échap, ← →), glisser au doigt, pellicule de
 * vignettes, focus retenu dans la boîte et rendu à la sortie.
 */
export function DetailImageViewer({ title, gallery, index, onIndexChange, onClose }: DetailImageViewerProps) {
  const { t } = useTranslation("media");
  const client = useJellyfinClient();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const [loaded, setLoaded] = useState<string | null>(null);
  const open = index !== null && gallery.length > 0;
  const count = gallery.length;

  const step = useCallback((delta: number) => {
    if (index === null || count < 2) return;
    onIndexChange((index + delta + count) % count);
  }, [index, count, onIndexChange]);

  useImageViewerControls({ open, count, onClose, onStep: step, dialogRef, initialFocusRef: closeRef });

  const current = open ? gallery[Math.min(index, count - 1)] : null;
  const src = current ? fullUrl(client, current) : null;

  // Le geste qui change d'image, lu au rendu qu'il déclenche.
  const keyboard = lastInputWasKeyboard();
  return createPortal(
    <AnimatePresence>
      {current && src && (
        <motion.div
          ref={dialogRef}
          key="viewer"
          role="dialog"
          aria-modal="true"
          aria-label={t("imageViewerTitle", { title })}
          // Une visionneuse d'images : tout y est « posé sur média », dans les deux thèmes.
          className="fixed inset-0 z-[70] flex flex-col text-on-media-primary"
          style={{ background: "rgba(11, 11, 12, 0.96)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: exitDuration(duration.base) } }}
          transition={{ duration: duration.base, ease: easeOut }}
          onTouchStart={(e) => { touchX.current = e.touches[0]?.clientX ?? null; }}
          onTouchEnd={(e) => {
            if (touchX.current === null) return;
            const delta = swipeDelta(touchX.current, e.changedTouches[0]?.clientX ?? touchX.current);
            touchX.current = null;
            if (delta) step(delta);
          }}
        >
          <header className="relative z-10 flex items-center gap-4 px-4 pb-2 pt-4 md:px-8 md:pt-6">
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold">{title}</p>
              <p className="text-xs tabular-nums text-on-media-secondary" aria-live="polite">
                {t(KIND_KEY[current.kind])}
                {count > 1 && <> · {t("imageViewerCounter", { index: (index ?? 0) + 1, count })}</>}
              </p>
            </div>
            <GlassButton
              ref={closeRef}
              onClick={onClose}
              aria-label={t("imageViewerClose")}
              title={t("imageViewerClose")}
              appearance={VIEWER_ROUND}
              className="flex h-10 w-10 items-center justify-center"
              fallbackClassName={VIEWER_ROUND_SKIN}
            >
              <XIcon size={20} aria-hidden />
            </GlassButton>
          </header>

          {/* Clic dans le vide = fermer ; clic sur l'image = rien. */}
          <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 md:px-20" onClick={onClose}>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.img
                key={current.key}
                src={src}
                alt={`${title} — ${t(KIND_KEY[current.kind])}`}
                draggable={false}
                onClick={(e) => e.stopPropagation()}
                onLoad={() => setLoaded(src)}
                // Parcourue au clavier (← →, touche maintenue comprise), l'image suivante est là
                // d'emblée : une touche ne s'anime pas. À la souris : un fondu et une échelle
                // légère, en `transform` entier (le seul que framer confie au compositeur).
                initial={keyboard ? false : { opacity: 0, transform: "scale(0.97)" }}
                animate={{ opacity: loaded === src ? 1 : 0.35, transform: "scale(1)" }}
                exit={{ opacity: 0, transition: { duration: keyboard ? 0 : exitDuration(duration.base) } }}
                transition={{ duration: keyboard ? 0 : duration.base, ease: easeOut }}
                className="max-h-full max-w-full rounded-[var(--radius-lg)] object-contain shadow-[0_30px_80px_rgba(0,0,0,0.6)]"
                /* tv-compat-ok: une <img> chargée garde son ratio naturel ; seule la réservation avant chargement se perd */
                style={{ aspectRatio: String(current.aspect) }}
              />
            </AnimatePresence>
            {count > 1 && (
              <>
                <StepButton side="left" label={t("imageViewerPrevious")} onClick={() => step(-1)} />
                <StepButton side="right" label={t("imageViewerNext")} onClick={() => step(1)} />
              </>
            )}
          </div>

          {count > 1 && (
            <nav className="flex justify-center px-4 pb-5 pt-3" aria-label={t("imageViewerTitle", { title })}>
              <ul className="flex max-w-full gap-2 overflow-x-auto px-1 py-1 scrollbar-none">
                {gallery.map((ref, i) => (
                  <li key={ref.key} className="flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => onIndexChange(i)}
                      aria-label={t("imageViewerShow", { index: i + 1 })}
                      aria-current={i === index ? "true" : undefined}
                      className={`block overflow-hidden rounded-chip transition-opacity duration-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--border-focus)] ${
                        i === index ? "opacity-100 ring-2 ring-on-media-primary ring-offset-2 ring-offset-[#0B0B0C]" : "opacity-50 hover:opacity-90"
                      }`}
                    >
                      <img src={thumbUrl(client, ref)} alt="" draggable={false} className="h-14 w-auto object-cover" style={{ aspectRatio: String(ref.aspect) }} loading="lazy" /* tv-compat-ok: ratio naturel une fois chargée */ />
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

/** Les ronds de la visionneuse : en Liquid Glass (mode natif), le rond de verre
 * CLAIR de la fiche (lot lg7, R16) ; ailleurs, le rond sur image du socle. */
const VIEWER_ROUND = { material: "bead", tone: "dark", level: "clear", shape: "circle" } as const;
const VIEWER_ROUND_SKIN = "icon-btn btn-on-media";

function StepButton({ side, label, onClick }: { side: "left" | "right"; label: string; onClick: () => void }) {
  return (
    <GlassButton
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      aria-label={label}
      title={label}
      appearance={VIEWER_ROUND}
      className={`!absolute top-1/2 hidden h-12 w-12 -translate-y-1/2 items-center justify-center md:flex ${
        side === "left" ? "left-5" : "right-5"
      }`}
      fallbackClassName={VIEWER_ROUND_SKIN}
    >
      {side === "left" ? <CaretLeftIcon size={22} aria-hidden /> : <CaretRightIcon size={22} aria-hidden />}
    </GlassButton>
  );
}
