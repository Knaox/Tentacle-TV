import { CaretDownIcon } from "@phosphor-icons/react/dist/csr/CaretDown";
import { ChatCircleTextIcon } from "@phosphor-icons/react/dist/csr/ChatCircleText";
import { duration, easeOut } from "../../theme/motion";
import { surfaceHasAlpha } from "../../lib/videoShadow";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { animate, AnimatePresence, motion, useDragControls, type MotionValue } from "framer-motion";
import type { WtChatApi } from "@tentacle-tv/api-client";
import { ChatPanel } from "./ChatPanel";
import { setChatResizeLock, useWatchOverlayState } from "./chatUiStore";
import { useChatPanelSize } from "./useChatPanelSize";
import { useChatActivity } from "./useChatActivity";
import { useWatchTogether } from "../WatchTogetherProvider";
import { firstUnreadId } from "./chatThread";
import "./chat.css";

/** La surface de la page a-t-elle un alpha par pixel (macOS, Linux : la fenêtre posée sur mpv) ? */
const ALPHA_SURFACE = surfaceHasAlpha();

/**
 * Watch Together — overlay flottant du chat : bulle réduite (badge non-lus)
 * ↔ panneau de conversation. Déplaçable (framer drag) depuis la bulle ou la
 * barre de titre du panneau ; sur mobile le panneau s'ancre en bas de l'écran
 * (bottom sheet) et seule la bulle se déplace.
 *
 * Drag SANS contraintes (libre sur tout l'écran, pages player comprises) ;
 * au relâcher, l'overlay est ramené en douceur dans le viewport s'il dépasse.
 * Sur une page player, bulle et panneau suivent le fondu des contrôles
 * (chatUiStore) — les messages restent lisibles via MessageToastLayer.
 *
 * Deux habits (`chat.css`, lot rf2) : sur une page de LECTURE, une encre sombre
 * en dur, identique dans les deux thèmes (elle flotte sur la vidéo) ; partout
 * ailleurs, les jetons du thème — en thème clair le chat est clair. Opaque,
 * sans flou, dans les deux cas.
 */

function useIsMobile(): boolean {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 640px)").matches);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => setMobile(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return mobile;
}

function ChatIcon({ filled = false }: { filled?: boolean }) {
  return <ChatCircleTextIcon size={20} weight={filled ? "fill" : "regular"} aria-hidden />;
}

export function ChatOverlay({
  chat, dragX, dragY,
}: {
  chat: WtChatApi;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
}) {
  const { t } = useTranslation("watchTogether");
  const isMobile = useIsMobile();
  const dragControls = useDragControls();
  const { open, unread } = chat.state;
  const watchOverlay = useWatchOverlayState();
  const { selfId, room } = useWatchTogether();
  // Le premier message non lu, relevé AVANT d'ouvrir (l'ouverture remet le compteur à zéro) :
  // le fil pose sa marque « Nouveaux messages » au-dessus de lui.
  const [unreadFromId, setUnreadFromId] = useState<string | null>(null);
  const openPanel = useCallback(() => {
    setUnreadFromId(firstUnreadId(chat.state.messages, chat.state.unread, selfId));
    chat.setOpen(true);
  }, [chat, selfId]);
  const skin = { "data-on-video": watchOverlay.onWatchPage, "data-alpha": ALPHA_SURFACE || undefined };
  const members = room?.members.length ?? 0;
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Un clic sur la bulle ne doit pas ouvrir le panneau après un VRAI drag :
  // le drag framer démarre dès le pointerdown (dragControls.start), donc le
  // tap framer est avalé par le geste — on passe par le click natif + ce flag
  // (onDragStart ne se déclenche qu'au-delà du seuil de mouvement ~3 px).
  const wasDraggedRef = useRef(false);

  // Page player : bulle ET panneau suivent STRICTEMENT le fondu de l'overlay
  // des contrôles (les aperçus MessageToastLayer restent visibles, eux). Les
  // interactions avec le chat (frappe, survol en mouvement, clics, scroll)
  // sont publiées au lecteur en impulsions horodatées AUTO-EXPIRANTES
  // (useChatActivity → chatUiStore) : le timer d'auto-masquage attend que la
  // dernière impulsion soit froide, puis chat et contrôles s'estompent
  // ENSEMBLE — un focus resté dans l'input après un envoi ne bloque plus
  // jamais le masquage. Seul le drag de resize pose un verrou dur.
  const activity = useChatActivity();

  // Rappel dans le viewport (marge 8 px) après un drag ou une ouverture qui
  // ferait dépasser le panneau (bulle garée près d'un bord).
  const settleIntoViewport = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 8;
    let dx = 0;
    let dy = 0;
    if (r.right > window.innerWidth - margin) dx = window.innerWidth - margin - r.right;
    if (r.left + dx < margin) dx = margin - r.left;
    if (r.bottom > window.innerHeight - margin) dy = window.innerHeight - margin - r.bottom;
    if (r.top + dy < margin) dy = margin - r.top;
    if (dx) animate(dragX, dragX.get() + dx, { type: "spring", bounce: 0, duration: 0.3 });
    if (dy) animate(dragY, dragY.get() + dy, { type: "spring", bounce: 0, duration: 0.3 });
  }, [dragX, dragY]);

  // Taille du panneau desktop (poignée coin haut-gauche, persistée).
  const { size, resizing, startResize } = useChatPanelSize(settleIntoViewport);

  const hidden = watchOverlay.onWatchPage && !watchOverlay.controlsVisible;

  useEffect(() => {
    setChatResizeLock(resizing);
  }, [resizing]);
  useEffect(() => () => setChatResizeLock(false), []);

  useEffect(() => {
    if (open) {
      const raf = requestAnimationFrame(settleIntoViewport);
      return () => cancelAnimationFrame(raf);
    }
  }, [open, settleIntoViewport]);

  // Sortie du plein écran / redimensionnement : le viewport rétrécit et une
  // bulle garée loin peut se retrouver HORS écran (offset de drag conservé),
  // donc insaisissable. Double rAF : on mesure après le re-ciblage du portail
  // et le layout qui suivent le fullscreenchange.
  useEffect(() => {
    const resettle = () => {
      requestAnimationFrame(() => requestAnimationFrame(settleIntoViewport));
    };
    window.addEventListener("resize", resettle);
    document.addEventListener("fullscreenchange", resettle);
    return () => {
      window.removeEventListener("resize", resettle);
      document.removeEventListener("fullscreenchange", resettle);
    };
  }, [settleIntoViewport]);

  // Mobile ouvert : bottom sheet fixe (hors drag) — la frappe au clavier
  // virtuel et le scroll ne doivent pas déclencher de déplacement.
  if (isMobile && open) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: hidden ? 0 : 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.2, ease: easeOut }}
        className="wtc wtc-panel !fixed inset-x-2 bottom-2 z-50 h-[60vh] max-h-[60vh]"
        style={{ pointerEvents: hidden ? "none" : "auto" }}
        {...skin}
        {...activity.handlers}
      >
        <ChatHeader title={t("chatTitle")} members={members} onClose={() => chat.setOpen(false)} />
        <ChatPanel chat={chat} unreadFromId={unreadFromId} />
      </motion.div>
    );
  }

  return (
    <motion.div
      ref={rootRef}
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      onDragStart={() => { wasDraggedRef.current = true; }}
      onDragEnd={() => {
        settleIntoViewport();
        // Reset APRÈS le click natif qui suit le pointerup du drag.
        requestAnimationFrame(() => { wasDraggedRef.current = false; });
      }}
      initial={false}
      animate={{ opacity: hidden ? 0 : 1 }}
      transition={{ duration: 0.3 }}
      style={{ x: dragX, y: dragY, pointerEvents: hidden ? "none" : "auto" }}
      // Au-dessus de la pilule de saut du lecteur (104 à 148 px du bas quand les contrôles sont
      // là) : à 96 px, la bulle se posait dessus dès qu'un passage se proposait en séance.
      className="wtc fixed bottom-40 right-6 z-50 flex flex-col items-end"
      {...skin}
      {...activity.handlers}
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="panel"
            // Il sort de sa bulle (en bas à droite) : 180 ms depuis 96 %, 120 ms au retour.
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1, transition: { duration: duration.menuIn, ease: easeOut } }}
            exit={{ opacity: 0, scale: 0.96, transition: { duration: duration.menuOut, ease: easeOut } }}
            className={`wtc-panel ${resizing ? "select-none" : ""}`}
            style={{ width: size.w, height: size.h, transformOrigin: "bottom right" }}
          >
            {/* Poignée de redimensionnement — coin haut-gauche (le panneau est
                ancré bas-droite : tirer vers la gauche/le haut agrandit). */}
            <div onPointerDown={startResize} className="wtc-grip" aria-hidden>
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
                <path strokeLinecap="round" d="M1 5 5 1M1 9 9 1" />
              </svg>
            </div>
            <ChatHeader
              title={t("chatTitle")}
              members={members}
              onClose={() => chat.setOpen(false)}
              onDragStart={(e) => dragControls.start(e)}
            />
            <ChatPanel chat={chat} unreadFromId={unreadFromId} />
          </motion.div>
        ) : (
          <motion.button
            key="bubble"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: duration.menuOut, ease: easeOut }}
            // La pression répond ; rien ne grossit au survol.
            whileTap={{ scale: 0.97 }}
            onPointerDown={(e) => dragControls.start(e)}
            onClick={() => { if (!wasDraggedRef.current) openPanel(); }}
            aria-label={unread > 0 ? t("chatUnreadAria", { count: unread }) : t("chatOpenAria")}
            className="wtc-capsule relative flex h-12 w-12 cursor-pointer touch-none items-center justify-center rounded-pill outline-none focus-visible:ring-2 focus-visible:ring-white/70"
          >
            <ChatIcon filled={unread > 0} />
            {unread > 0 && (
              // Indicateur discret (pas de compteur) : un point à la teinte franche, IMMOBILE —
              // une onde qui bat sans fin sur une vidéo coûte une composition par image.
              <span className="wtc-unread" aria-hidden />
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Barre de titre du panneau — poignée de glissement sur le bureau. */
function ChatHeader({
  title, members, onClose, onDragStart,
}: {
  title: string;
  /** Combien de membres dans le groupe (0 : inconnu, rien d'affiché). */
  members: number;
  onClose: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}) {
  const { t } = useTranslation("watchTogether");
  return (
    <div onPointerDown={onDragStart} className={`wtc-head ${onDragStart ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}>
      <span className="wtc-head__title">
        <ChatIcon />
        <span className="truncate">{title}</span>
        {members > 0 && <span className="wtc-head__count">{t("membersCount", { count: members })}</span>}
      </span>
      <button
        type="button"
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        className="wtc-icon"
        aria-label={t("chatCollapse")}
        title={t("chatCollapse")}
      >
        <CaretDownIcon size={16} weight="bold" aria-hidden />
      </button>
    </div>
  );
}
