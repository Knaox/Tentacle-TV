import { useEffect, useState, type RefObject } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useDragControls, type MotionValue } from "framer-motion";
import type { WtChatApi } from "./useWtChat";
import { ChatPanel } from "./ChatPanel";

/**
 * Watch Together — overlay flottant du chat : bulle réduite (badge non-lus)
 * ↔ panneau de conversation. Déplaçable (framer drag) depuis la bulle ou la
 * barre de titre du panneau ; sur mobile le panneau s'ancre en bas de l'écran
 * (bottom sheet) et seule la bulle se déplace.
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
  chat, dragX, dragY, boundsRef,
}: {
  chat: WtChatApi;
  dragX: MotionValue<number>;
  dragY: MotionValue<number>;
  boundsRef: RefObject<HTMLDivElement | null>;
}) {
  const { t } = useTranslation("watchTogether");
  const isMobile = useIsMobile();
  const dragControls = useDragControls();
  const { open, unread } = chat.state;

  // Mobile ouvert : bottom sheet fixe (hors drag) — la frappe au clavier
  // virtuel et le scroll ne doivent pas déclencher de déplacement.
  if (isMobile && open) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 32 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="fixed inset-x-2 bottom-2 z-50 flex max-h-[60vh] flex-col overflow-hidden rounded-2xl"
        style={GLASS}
      >
        <ChatHeader title={t("chatTitle")} onClose={() => chat.setOpen(false)} />
        <ChatPanel chat={chat} />
      </motion.div>
    );
  }

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragConstraints={boundsRef}
      dragMomentum={false}
      dragElastic={0}
      style={{ x: dragX, y: dragY }}
      className="fixed bottom-24 right-5 z-50 flex flex-col items-end"
    >
      <AnimatePresence mode="wait" initial={false}>
        {open ? (
          <motion.div
            key="panel"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex h-[420px] w-80 flex-col overflow-hidden rounded-2xl"
            style={GLASS}
          >
            <ChatHeader
              title={t("chatTitle")}
              onClose={() => chat.setOpen(false)}
              onDragStart={(e) => dragControls.start(e)}
            />
            <ChatPanel chat={chat} />
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
            onTap={() => chat.setOpen(true)}
            aria-label={unread > 0 ? t("chatUnreadAria", { count: unread }) : t("chatOpenAria")}
            className="relative flex h-12 w-12 cursor-pointer touch-none items-center justify-center rounded-full text-white/85"
            style={GLASS}
          >
            <ChatIcon />
            {unread > 0 && (
              <span
                className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white"
                style={{ background: "linear-gradient(135deg, #8b5cf6, #ec4899)" }}
              >
                {unread > 9 ? "9+" : unread}
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
