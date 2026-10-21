/**
 * Bouton « compteur de vitesse » + son menu de paliers (0,5× → 4×).
 *
 * Un seul composant pour les deux lecteurs : le web applique le taux sur
 * `video.playbackRate`, le desktop sur la propriété mpv `speed`. La différence
 * tient dans la fonction `apply` passée en prop — rien d'autre ne change,
 * et la barre desktop n'a donc pas son propre menu à maintenir.
 *
 * Watch Together : le composant se retire complètement en séance de groupe. La
 * boucle de dérive (useGroupDriftLoop) pilote elle-même le taux pour rattraper
 * les écarts ; laisser le menu ouvert, c'était offrir un réglage que le groupe
 * écrasait silencieusement la seconde d'après.
 *
 * # Un seul panneau à la fois
 *
 * Le menu tenait son ouverture pour lui seul, là où les deux autres panneaux du
 * lecteur (pistes, épisodes) se fermaient déjà l'un l'autre : on pouvait donc
 * ouvrir la vitesse PAR-DESSUS la liste des épisodes, et les deux se
 * chevauchaient. Il ne lève pas l'état pour autant — deux barres différentes le
 * montent, et leur ajouter un état partagé aurait fait deux fois le même
 * câblage. Il ANNONCE son ouverture (`onOpen`) et se ferme quand on lui dit
 * qu'un autre est ouvert (`otherPanelOpen`) : la barre reste seule juge.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { PLAYBACK_RATES, formatRate, isNormalRate } from "@tentacle-tv/shared";
import { useWatchTogether } from "../../watchTogether/WatchTogetherProvider";
import { SpeedIcon } from "../PlayerIcons";
import { usePlaybackRate, type PlaybackRateState } from "./usePlaybackRate";
import { usePlayerGlassMode } from "../player/glass/PlayerGlassContext";
import { isGlassLayout } from "../player/glass/playerGlassMode";
import { GlassPanel } from "../player/glass/GlassPanel";
import { GlassOption } from "../player/glass/GlassOption";
import { GlassMorphSeed } from "../player/glass/GlassMorphSeed";
import { GLASS_LENS_PROPS } from "../../theme/glass";
import { PLAYER_MORPH } from "../player/glass/playerGlassFusion";
import { useGlassDock } from "../player/glass/glassDock";

interface PlaybackRateControlProps {
  /** Applique le taux au moteur (web : playbackRate ; desktop : mpv speed). */
  apply: (rate: number) => void;
  /** Change d'identité au changement de média → remise à 1×. */
  resetKey?: string;
  /** Classes du bouton, la barre web et la barre desktop n'ont pas le même padding. */
  buttonClass?: string;
  /** Un AUTRE panneau du lecteur est ouvert : celui-ci se retire. */
  otherPanelOpen?: boolean;
  /** Ce menu vient de s'ouvrir — à la barre de fermer les siens. */
  onOpen?: () => void;
  /**
   * Le taux, tenu PLUS HAUT (`usePlaybackRate`) quand ce bouton peut se
   * remonter en pleine lecture (le lecteur de bureau qui change d'habillage) ;
   * absent, le bouton tient le sien.
   */
  state?: PlaybackRateState;
}

export function PlaybackRateControl({
  apply, resetKey, buttonClass = "", otherPanelOpen = false, onOpen, state,
}: PlaybackRateControlProps) {
  const { t } = useTranslation("player");
  const { isInGroup } = useWatchTogether();
  const own = usePlaybackRate(apply, resetKey, state === undefined);
  const { rate, choose: chooseRate } = state ?? own;
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  // Verre : le menu est PORTÉ dans le dock, où se calent les deux autres
  // panneaux (`.lgp-popover`) — rendu dans la capsule, la transformée de son
  // apparition en ferait son bloc conteneur (`glassDock.ts`).
  const glass = isGlassLayout(usePlayerGlassMode());
  const dock = useGlassDock();

  // Le menu se referme au changement de média et à l'entrée en groupe (le taux,
  // lui, s'y remet à 1× : `usePlaybackRate`).
  useEffect(() => {
    setOpen(false);
  }, [resetKey, isInGroup]);

  // Un autre panneau prend la place : celui-ci se retire sans discuter.
  useEffect(() => {
    if (otherPanelOpen) setOpen(false);
  }, [otherPanelOpen]);

  // Fermeture au clic à l'extérieur. Les barres de contrôle arrêtent la
  // propagation, le clic sur la vidéo ne parvient donc jamais jusqu'ici.
  useEffect(() => {
    if (!open) return;
    const auClic = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!containerRef.current?.contains(target) && !panelRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("pointerdown", auClic, true);
    return () => document.removeEventListener("pointerdown", auClic, true);
  }, [open]);

  const choose = useCallback((value: number) => {
    chooseRate(value);
    setOpen(false);
  }, [chooseRate]);

  const openRef = useRef(onOpen);
  openRef.current = onOpen;
  const toggle = useCallback(() => {
    setOpen((previous) => {
      if (!previous) openRef.current?.();
      return !previous;
    });
  }, []);

  if (isInGroup) return null;

  // La présence vit DANS le portail : un portail n'est pas un élément pour
  // `AnimatePresence`, qui l'ignorerait — et le panneau ne rentrerait plus dans
  // son bouton à la fermeture.
  const glassMenu = (
    <AnimatePresence>
      {open && (
        <GlassPanel key="speed" morphId={PLAYER_MORPH.speed} surfaceRef={panelRef} className="w-52" bodyClassName="max-h-[60vh] overflow-y-auto p-2 scrollbar-thin" role="menu" aria-label={t("player:speed")}>
          <div className="mb-1 flex items-center justify-between gap-2 pl-2.5">
            <span className="lgp-section-title lgp-section-title--inline">{t("player:speed")}</span>
            <button type="button" onClick={() => setOpen(false)} aria-label={t("player:close")} title={t("player:close")} className="lgp-btn lgp-btn--small">
              <CloseGlyph />
            </button>
          </div>
          {PLAYBACK_RATES.map((value) => (
            <GlassOption key={value} active={value === rate} onClick={() => choose(value)}>{formatRate(value)}</GlassOption>
          ))}
        </GlassPanel>
      )}
    </AnimatePresence>
  );

  return (
    <div ref={containerRef} className={glass ? "" : "relative"}>
      <button
        {...(glass ? GLASS_LENS_PROPS : {})}
        onClick={toggle}
        className={glass ? "lgp-btn relative" : `relative rounded-full hover:bg-white/10 ${open ? "bg-white/10" : ""} ${buttonClass}`}
        title={t("player:speed")}
        aria-label={t("player:speed")}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {glass && <GlassMorphSeed id={PLAYER_MORPH.speed} />}
        <SpeedIcon />
        {/* Pastille du taux courant : seulement hors vitesse normale, sinon
            elle serait un « 1x » permanent qui n'apprend rien. */}
        {!isNormalRate(rate) && (
          <span className="absolute -right-0.5 -top-0.5 rounded-full bg-tentacle-accent px-1 text-[9px] font-bold leading-[14px] text-cta-brand-fg">
            {formatRate(rate)}
          </span>
        )}
      </button>

      {glass && (dock ? createPortal(glassMenu, dock) : glassMenu)}
      <AnimatePresence>
        {open && !glass && (
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
            className="absolute bottom-full right-0 z-50 mb-3 max-h-[60vh] w-40 overflow-y-auto rounded-xl border border-line-subtle bg-[var(--surface-dropdown)] p-2 scrollbar-thin"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Une croix pour refermer : le clic à l'extérieur marche, mais il
                ne se devine pas — et les deux autres panneaux du lecteur en ont
                une. */}
            <div className="mb-1 flex items-center justify-between gap-2 px-1">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-content-tertiary">
                {t("player:speed")}
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label={t("player:close")}
                title={t("player:close")}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-content-tertiary transition-colors hover:bg-fill-soft hover:text-content-primary"
              >
                <CloseGlyph />
              </button>
            </div>
            {PLAYBACK_RATES.map((value) => {
              const active = value === rate;
              return (
                <button
                  key={value}
                  role="menuitemradio"
                  aria-checked={active}
                  onClick={() => choose(value)}
                  className={`w-full rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    active
                      ? "bg-[rgba(var(--brand-rgb),0.25)] font-medium text-content-primary"
                      : "text-content-tertiary hover:bg-fill-subtle hover:text-content-primary"
                  }`}
                >
                  {formatRate(value)}
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CloseGlyph() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}
