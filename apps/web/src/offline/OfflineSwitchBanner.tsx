/**
 * Le bandeau qui EXPLIQUE la bascule hors ligne (desktop).
 *
 * Jusqu'ici, un serveur qui cessait de répondre remplaçait l'accueil par le
 * catalogue local en silence : seule une pastille ambre apparaissait dans la
 * barre du haut, muette tant qu'on ne cliquait pas dessus. On voyait sa
 * bibliothèque rétrécir sans savoir pourquoi. Le mobile a ce bandeau depuis
 * la 1.6 ; le bureau le rejoint, avec les mêmes textes.
 *
 * Il ne paraît qu'à la TRANSITION vers le hors ligne AUTOMATIQUE : jamais en
 * mode manuel, que l'utilisateur a demandé lui-même. Il s'efface tout seul —
 * ce n'est pas une alerte permanente, la pastille reste là pour ça.
 *
 * Animations en CSS pur (`animate-fade-slide-down`), comme le reste de la feature :
 * pas de Framer Motion ici, et seules l'opacité et la translation bougent.
 */

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { isDesktopApp } from "../desktop/bridge";
import { useConnectivity } from "./useConnectivity";

/** Le temps de lire, puis le bandeau s'efface. */
const VISIBLE_MS = 8_000;

export function OfflineSwitchBanner() {
  const { t } = useTranslation("downloads");
  const { state, reason } = useConnectivity();
  const [visible, setVisible] = useState(false);
  // Une fois par bascule : une connexion qui vacille ferait autrement clignoter
  // le bandeau à chaque aller-retour.
  const announced = useRef(false);

  useEffect(() => {
    if (state !== "offline-auto") {
      announced.current = false;
      setVisible(false);
      return;
    }
    if (announced.current) return;
    announced.current = true;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [state]);

  if (!isDesktopApp() || !visible) return null;
  const cause =
    reason === "jellyfin" ? t("offlineReasonJellyfin") : t("offlineReasonBackend");

  return (
    <div
      role="alert"
      className="pointer-events-auto fixed left-1/2 top-4 z-[300] w-[min(28rem,calc(100vw-2rem))] -translate-x-1/2 animate-fade-slide-down rounded-xl border border-line-subtle px-4 py-3"
      style={{ background: "var(--surface-modal)", boxShadow: "var(--shadow-modal)" }}
    >
      <div className="flex items-start gap-3">
        <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-status-warning-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 3l18 18M6.34 6.34A6.75 6.75 0 003 12.75 3.75 3.75 0 006.75 16.5h9M8.5 4.6a6.75 6.75 0 019.24 5.4A3.75 3.75 0 0120.4 15.6" />
        </svg>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-content-primary">{t("switchedOfflineTitle")}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-content-tertiary">
            {cause} {t("switchedOfflineHint")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setVisible(false)}
          aria-label={t("switchedOfflineDismiss")}
          title={t("switchedOfflineDismiss")}
          className="-mr-1 -mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-content-tertiary transition-colors duration-150 hover:bg-fill-soft hover:text-content-primary"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}
