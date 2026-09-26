import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { ArrowUp } from "lucide-react";
import { noMotion } from "../../theme/motion";
import { useMirrorChrome } from "../useMirrorLayout";
import { TAB_BAR_TOTAL } from "../shell/metrics";

/** En hauteurs d'écran : au-delà, le bouton se montre (`SCROLL_TOP_SCREENS`). */
const SCROLL_TOP_SCREENS = 1.5;

/**
 * « Revenir en haut » (`ui/ScrollTopFab` de l'app) : rond de 48 sur
 * `surface.s2`, filet `border.strong`, ombre portée, flèche 22 ; à 16 du bord
 * droit, 16 au-dessus de la barre d'onglets (ou du bas, en rail). Il apparaît
 * en fondu et monte de 12 (200 ms, opacité et translation seulement) ; caché,
 * il ne capte rien. React n'apprend que le franchissement du seuil.
 */
export function ScrollTopFab() {
  const { t } = useTranslation("common");
  const chrome = useMirrorChrome();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const onScroll = () => setShown(window.scrollY > window.innerHeight * SCROLL_TOP_SCREENS);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: noMotion() ? "auto" : "smooth" });
  }, []);

  const bottom = chrome !== "tabs"
    ? "calc(env(safe-area-inset-bottom, 0px) + 16px)"
    : `calc(${TAB_BAR_TOTAL} + 16px)`;

  return createPortal(
    <div
      className="fixed right-4 z-40"
      aria-hidden={!shown}
      style={{
        bottom,
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(12px)",
        transition: noMotion() ? "none" : "opacity 200ms ease-out, transform 200ms ease-out",
        pointerEvents: shown ? "auto" : "none",
      }}
    >
      <button
        type="button"
        onClick={scrollTop}
        tabIndex={shown ? 0 : -1}
        aria-label={t("scrollToTop")}
        className="flex h-12 w-12 items-center justify-center rounded-full border border-line-strong bg-surface-2 text-content-primary transition-transform duration-100 active:scale-[0.94]"
        style={{ boxShadow: "0 8px 16px rgba(0,0,0,0.45)" }}
      >
        <ArrowUp size={22} aria-hidden />
      </button>
    </div>,
    document.body,
  );
}
