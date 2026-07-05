import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useMotionValue } from "framer-motion";
import { useWtChat } from "./useWtChat";
import { ChatOverlay } from "./ChatOverlay";
import { ReactionLayer } from "./ReactionLayer";

/**
 * Watch Together — racine du chat de groupe, montée dans le Provider tant
 * qu'on est en groupe (visible sur toutes les pages).
 *
 * Portail DYNAMIQUE : le player passe son conteneur en fullscreen natif
 * (`containerRef.requestFullscreen()`), où seul son sous-arbre DOM est rendu —
 * un portail figé sur document.body y disparaîtrait. On re-cible donc le
 * portail sur `document.fullscreenElement` quand il existe. L'état (messages,
 * position de drag en motion values) vit ICI, au-dessus du portail : il
 * survit au re-parentage DOM.
 */
export function ChatRoot() {
  const chat = useWtChat();

  const [target, setTarget] = useState<HTMLElement>(() => document.body);
  useEffect(() => {
    const onFullscreenChange = () => {
      setTarget((document.fullscreenElement as HTMLElement | null) ?? document.body);
    };
    onFullscreenChange();
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Position de drag persistante (offset depuis l'ancrage bottom-right).
  const dragX = useMotionValue(0);
  const dragY = useMotionValue(0);

  // Zone de drag autorisée (l'overlay ne peut pas sortir de l'écran).
  const boundsRef = useRef<HTMLDivElement | null>(null);

  return createPortal(
    <>
      <div ref={boundsRef} className="pointer-events-none fixed inset-2 z-40" aria-hidden />
      <ReactionLayer reactions={chat.state.reactions} />
      <ChatOverlay chat={chat} dragX={dragX} dragY={dragY} boundsRef={boundsRef} />
    </>,
    target,
  );
}
