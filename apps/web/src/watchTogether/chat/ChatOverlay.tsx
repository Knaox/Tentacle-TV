import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { animate, AnimatePresence, motion, useDragControls, type MotionValue } from "framer-motion";
import type { WtChatApi } from "./useWtChat";
import { ChatPanel } from "./ChatPanel";
import { reportChatActivity, useWatchOverlayState } from "./chatUiStore";
import { useChatPanelSize } from "./useChatPanelSize";
import { useChatActivity } from "./useChatActivity";

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
 * Couleurs volontairement en dur (ici et dans ChatPanel/ReactionPicker/
 * EmojiTab/GifTab) : c'est l'« overlay de chat en lecture » — même verre
 * sombre flottant au-dessus de la vidéo ou de n'importe quelle page, donc
 * indépendant du thème choisi.
 */

const GLASS: React.CSSProperties = {
  background: "rgba(15,15,25,0.92)",
  backdropFilter: "blur(16px)",
  border: "1px solid rgba(139,92,246,0.35)",
  boxShadow: "0 8px 30px rgba(0,0,0,0.5), 0 0 20px rgba(139,92,246,0.15)",
};

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

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="h-5 w-5">
      <path
        strokeLinecap="round" strokeLinejoin="round"
        d="M8 10.5h8M8 14h4.5M21 12a8.96 8.96 0 0 1-9 9 9.05 9.05 0 0 1-4.1-.98L3 21l.98-4.9A8.96 8.96 0 0 1 3 12a9 9 0 1 1 18 0Z"
      />
    </svg>
  );
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
  const rootRef = useRef<HTMLDivElement | null>(null);
  // Un clic sur la bulle ne doit pas ouvrir le panneau après un VRAI drag :
  // le drag framer démarre dès le pointerdown (dragControls.start), donc le
  // tap framer est avalé par le geste — on passe par le click natif + ce flag
  // (onDragStart ne se déclenche qu'au-delà du seuil de mouvement ~3 px).
  const wasDraggedRef = useRef(false);

  // Page player : bulle ET panneau suivent STRICTEMENT le fondu de l'overlay
  // des contrôles (les aperçus MessageToastLayer restent visibles, eux). Une
  // interaction avec le chat (saisie, survol, clics émoji, scroll GIFs,
  // resize) ne rend pas le chat indépendant : elle est PUBLIÉE au lecteur
  // (reportChatActivity), dont le timer d'auto-masquage s'abstient de cacher
  // les contrôles tant qu'elle dure — chat et contrôles restent visibles et
  // s'estompent toujours ENSEMBLE.
  const [inputFocused, setInputFocused] = useState(false);
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

  const chatBusy = activity.active || inputFocused || resizing;
  useEffect(() => {
    reportChatActivity(chatBusy);
  }, [chatBusy]);
  useEffect(() => () => reportChatActivity(false), []);

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
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed inset-x-2 bottom-2 z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-2xl"
        style={{ ...GLASS, pointerEvents: hidden ? "none" : "auto" }}
        {...activity.handlers}
      >
        <ChatHeader title={t("chatTitle")} onClose={() => chat.setOpen(false)} />
        <ChatPanel chat={chat} onInputFocusChange={setInputFocused} />
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
      className="fixed bottom-24 right-5 z-50 flex flex-col items-end"
      {...activity.handlers}
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className={`relative flex flex-col overflow-hidden rounded-2xl ${resizing ? "select-none" : ""}`}
            style={{ ...GLASS, width: size.w, height: size.h }}
          >
            {/* Poignée de redimensionnement — coin haut-gauche (le panneau est
                ancré bas-droite : tirer vers la gauche/le haut agrandit). */}
            <div
              onPointerDown={startResize}
              className="absolute left-0 top-0 z-10 h-6 w-6 cursor-nwse-resize p-1.5 text-white/25 transition-colors hover:text-white/70"
              aria-hidden
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth={1.3} className="h-full w-full">
                <path strokeLinecap="round" d="M1 5 5 1M1 9 9 1" />
              </svg>
            </div>
            <ChatHeader
              title={t("chatTitle")}
              onClose={() => chat.setOpen(false)}
              onDragStart={(e) => dragControls.start(e)}
            />
            <ChatPanel chat={chat} onInputFocusChange={setInputFocused} />
          </motion.div>
        ) : (
          <motion.button
            key="bubble"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            whileHover={{ scale: 1.08 }}
            onPointerDown={(e) => dragControls.start(e)}
            onClick={() => { if (!wasDraggedRef.current) chat.setOpen(true); }}
            aria-label={unread > 0 ? t("chatUnreadAria", { count: unread }) : t("chatOpenAria")}
            className="relative flex h-12 w-12 cursor-pointer touch-none items-center justify-center rounded-full text-white/85"
            style={GLASS}
          >
            <ChatIcon />
            {unread > 0 && (
              // Indicateur discret (pas de compteur) : simple point rose,
              // même langage visuel que le point de présence du header.
              <span className="absolute right-0 top-0 flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pink-400 opacity-60" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pink-400" />
              </span>
            )}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/** Barre de titre du panneau — poignée de drag sur desktop. */
function ChatHeader({
  title, onClose, onDragStart,
}: {
  title: string;
  onClose: () => void;
  onDragStart?: (e: React.PointerEvent) => void;
}) {
  return (
    <div
      onPointerDown={onDragStart}
      className={`flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-2.5 ${onDragStart ? "cursor-grab touch-none active:cursor-grabbing" : ""}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-white/90">
        <span className="text-purple-300"><ChatIcon /></span>
        {title}
      </span>
      <button
        onClick={onClose}
        onPointerDown={(e) => e.stopPropagation()}
        className="rounded-lg p-1 text-white/50 transition-colors hover:bg-white/10 hover:text-white"
        aria-label={title}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25 12 15.75 4.5 8.25" />
        </svg>
      </button>
    </div>
  );
}
