/**
 * Bouton « compteur de vitesse » + son menu de paliers (0,5× → 4×).
 *
 * Un seul composant pour les deux lecteurs : le web applique le taux sur
 * `video.playbackRate`, le desktop sur la propriété mpv `speed`. La différence
 * tient dans la fonction `appliquer` passée en prop — rien d'autre ne change,
 * et la barre desktop n'a donc pas son propre menu à maintenir.
 *
 * Watch Together : le composant se retire complètement en séance de groupe. La
 * boucle de dérive (useGroupDriftLoop) pilote elle-même le taux pour rattraper
 * les écarts ; laisser le menu ouvert, c'était offrir un réglage que le groupe
 * écrasait silencieusement la seconde d'après.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { PLAYBACK_RATES, NORMAL_RATE, formatRate, isNormalRate } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { SpeedIcon } from "../PlayerIcons";

interface PlaybackRateControlProps {
  /** Applique le taux au moteur (web : playbackRate ; desktop : mpv speed). */
  appliquer: (taux: number) => void;
  /** Change d'identité au changement de média → remise à 1×. */
  cleReset?: string;
  /** Classes du bouton, la barre web et la barre desktop n'ont pas le même padding. */
  classeBouton?: string;
}

export function PlaybackRateControl({ appliquer, cleReset, classeBouton = "" }: PlaybackRateControlProps) {
  const { t } = useTranslation("player");
  const { isInGroup } = useWatchTogether();
  const [taux, setTaux] = useState<number>(NORMAL_RATE);
  const [ouvert, setOuvert] = useState(false);
  const conteneurRef = useRef<HTMLDivElement>(null);

  // `appliquer` est recréée à chaque rendu du parent : la garder en ref évite
  // de relancer la remise à 1× à chaque tour.
  const appliquerRef = useRef(appliquer);
  appliquerRef.current = appliquer;

  // Remise à la vitesse normale au changement de média et à l'entrée en groupe.
  // Indispensable côté mpv : sa propriété `speed` SURVIT au loadfile, donc un
  // épisode lancé à 2× repartirait à 2× sans que rien ne l'affiche.
  useEffect(() => {
    setTaux(NORMAL_RATE);
    appliquerRef.current(NORMAL_RATE);
    setOuvert(false);
  }, [cleReset, isInGroup]);

  // Fermeture au clic à l'extérieur. Les barres de contrôle arrêtent la
  // propagation, le clic sur la vidéo ne parvient donc jamais jusqu'ici.
  useEffect(() => {
    if (!ouvert) return;
    const auClic = (e: PointerEvent) => {
      if (!conteneurRef.current?.contains(e.target as Node)) setOuvert(false);
    };
    document.addEventListener("pointerdown", auClic, true);
    return () => document.removeEventListener("pointerdown", auClic, true);
  }, [ouvert]);

  const choisir = useCallback((valeur: number) => {
    setTaux(valeur);
    appliquerRef.current(valeur);
    setOuvert(false);
  }, []);

  if (isInGroup) return null;

  return (
    <div ref={conteneurRef} className="relative">
      <button
        onClick={() => setOuvert((p) => !p)}
        className={`relative rounded-full hover:bg-white/10 ${ouvert ? "bg-white/10" : ""} ${classeBouton}`}
        title={t("player:speed")}
        aria-label={t("player:speed")}
        aria-haspopup="menu"
        aria-expanded={ouvert}
      >
        <SpeedIcon />
        {/* Pastille du taux courant : seulement hors vitesse normale, sinon
            elle serait un « 1x » permanent qui n'apprend rien. */}
        {!isNormalRate(taux) && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-tentacle-accent px-1 text-[9px] font-bold leading-[14px] text-cta-brand-fg">
            {formatRate(taux)}
          </span>
        )}
      </button>

      <AnimatePresence>
        {ouvert && (
          // Panneau DÉTACHÉ, fond quasi-opaque `surface-dropdown` comme
          // TrackSelector — donc pas de `backdrop-filter` : il ne resterait
          // rien à flouter, et sur macOS/Linux toute couche à alpha composée
          // sur la fenêtre de mpv se paie (cf. DesktopPlayerControls).
          <motion.div data-panneau-detache
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            role="menu"
            aria-label={t("player:speed")}
            className="absolute bottom-full right-0 z-50 mb-3 max-h-[60vh] w-36 overflow-y-auto rounded-xl border border-line-subtle bg-[var(--surface-dropdown)] p-2 scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {PLAYBACK_RATES.map((valeur) => {
              const actif = valeur === taux;
              return (
                <button
                  key={valeur}
                  role="menuitemradio"
                  aria-checked={actif}
                  onClick={() => choisir(valeur)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    actif
                      ? "bg-tentacle-accent/25 font-medium text-content-primary"
                      : "text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
                  }`}
                >
                  {formatRate(valeur)}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
