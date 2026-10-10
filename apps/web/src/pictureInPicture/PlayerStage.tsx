import { memo, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Route, Routes, useLocation, useNavigate, type Location, type NavigateOptions } from "react-router-dom";
import { Watch } from "../lazyPages";
import { invoke } from "../desktop/bridge";
import { getMpvApi } from "../hooks/mpvRuntime";
import { markPlayerExit } from "../components/detail/detailTransition";
import { PictureInPictureContext, type PictureInPicture, type PipGesture } from "./pictureInPictureContext";
import { PipWindow } from "./PipWindow";
import {
  DEFAULT_PIP_MODE, endPipSession, getPipSession, startPipSession,
  updatePipSession, usePipSession, watchLocation, type PipMode,
} from "./pictureInPictureStore";
import {
  initialPipSize, pipAspect, rememberedPipWidth, rememberPipWidth, scalePipSize, type PipFrame, type PipSize,
} from "./pipGeometry";

/**
 * La scène du lecteur : là où il est monté, HORS des routes de l'application.
 *
 * C'est ce qui rend le PiP possible. Sous la route `/watch/:itemId`, le lecteur
 * mourait à la première navigation — mpv arrêté, la lecture perdue. Ici, il est
 * rendu par ses propres `Routes`, sur la route du lecteur quand on y est, sur
 * celle que la session PiP garde quand on parcourt l'application : le même
 * élément au même endroit, React garde l'instance, la lecture ne s'interrompt
 * pas. Les routes de l'application, elles, ne rendent plus rien sur `/watch`.
 *
 * Montée seulement là où le PiP existe (`supportsPictureInPicture`) :
 * ailleurs, la route rend le lecteur comme avant.
 */

const PlayerRoutes = memo(function PlayerRoutes({ location }: { location: Location }) {
  return (
    <Suspense fallback={null}>
      <Routes location={location}>
        <Route path="/watch/:itemId" element={<Watch />} />
      </Routes>
    </Suspense>
  );
});

/** La largeur de l'écran de la fenêtre PiP si elle est ouverte, sinon de l'application. */
function screenWidthOf(child: Window | null): number {
  return child?.screen.availWidth ?? window.screen.availWidth;
}

/** Réduire : la page quitte le lecteur au plus tard après ce délai. */
const LEAVE_FALLBACK_MS = 1200;

function pathOf(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function PlayerStage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = usePipSession();
  const onWatch = location.pathname.startsWith("/watch/");
  const active = session !== null && !onWatch;
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [frame, setFrame] = useState<PipFrame>({ shadow: 0, bezel: 0 });
  const childRef = useRef<Window | null>(null);
  const sizeRef = useRef<PipSize | null>(null);
  const aspectRef = useRef(16 / 9);
  // Fermée par nous pour revenir au lecteur : ce n'est pas une perte.
  const expandingRef = useRef(false);
  // Réduire : la page ne quitte le lecteur qu'une fois la vidéo dans le PiP.
  const leavingRef = useRef(false);

  // Une lecture demandée par la page — un autre titre, ou le retour au lecteur —
  // prend le pas sur le PiP. Pas la route qu'il garde : la session naît sur
  // elle, juste avant que `navigate(-1)` ne la quitte.
  const sessionKey = session?.location.key ?? null;
  // Pas pendant le retour au lecteur : le PiP s'y ferme lui-même (`expand`).
  useEffect(() => {
    if (onWatch && sessionKey !== null && location.key !== sessionKey && !expandingRef.current) endPipSession();
  }, [onWatch, sessionKey, location.key]);

  /**
   * Quitter le lecteur, une fois la fenêtre PiP à l'écran — la vidéo y est
   * alors, au même endroit : la page d'avant paraît dessous pendant qu'elle
   * glisse à son coin. Avant, la page partait la première, et la vidéo restait
   * cachée sous elle ~180 ms, le temps que le PiP naisse (mesuré).
   */
  const leavePlayer = useCallback(() => {
    if (!leavingRef.current) return;
    leavingRef.current = false;
    markPlayerExit();
    void navigate(-1);
  }, [navigate]);

  const reduce = useCallback(async ({ restoreFullscreen }: { restoreFullscreen: boolean }) => {
    if (!location.pathname.startsWith("/watch/") || getPipSession() !== null) return;
    const mode = DEFAULT_PIP_MODE;
    const raw = await getMpvApi()?.getProperty("video-params/aspect", "double").catch(() => null);
    aspectRef.current = pipAspect(raw);
    sizeRef.current = initialPipSize(
      mode, aspectRef.current, window.screen.availWidth, window.innerWidth,
      mode === "floating" ? rememberedPipWidth() : null,
    );
    // Le plein écran posé par le film est rendu : on parcourt l'application.
    try { await invoke("player_fullscreen_leave"); } catch { /* on réduit quand même */ }
    expandingRef.current = false;
    // La session AVANT la navigation : quand la route quitte /watch, le lecteur reste monté.
    leavingRef.current = true;
    startPipSession({ location, mode, restoreFullscreen });
    // Filet : une fenêtre qui ne se montrerait pas ne retient pas l'utilisateur.
    window.setTimeout(leavePlayer, LEAVE_FALLBACK_MS);
  }, [location, leavePlayer]);

  const expand = useCallback(async () => {
    const current = getPipSession();
    if (current === null) return;
    expandingRef.current = true;
    // L'image regagne d'abord sa place dans le lecteur (la coquille l'anime ;
    // rien sous Linux, où la commande rend la main aussitôt).
    try { await invoke("pip_restore"); } catch { /* retour sans animation */ }
    let fullscreen = false;
    try { fullscreen = await invoke<boolean>("player_fullscreen_enter"); } catch { /* fenêtré */ }
    // Le lecteur reparaît SOUS le PiP, qui garde l'image au même endroit ; le
    // PiP ne se ferme qu'une fois la page du lecteur peinte (deux images) —
    // jamais la vidéo rendue à une page encore opaque.
    void navigate(pathOf(current.location), { state: current.location.state });
    window.requestAnimationFrame(() => window.requestAnimationFrame(() => {
      endPipSession();
      expandingRef.current = false;
      if (current.restoreFullscreen && !fullscreen) void invoke("toggle_fullscreen").catch(() => {});
    }));
  }, [navigate]);

  const close = useCallback(() => { endPipSession(); }, []);

  const onLost = useCallback(() => {
    if (!expandingRef.current) endPipSession();
  }, []);

  const setMode = useCallback((mode: PipMode) => {
    const size = initialPipSize(
      mode, aspectRef.current, screenWidthOf(childRef.current), window.innerWidth,
      mode === "floating" ? rememberedPipWidth() : null,
    );
    sizeRef.current = size;
    void invoke("pip_mode", { mode, width: size.width, height: size.height }).catch(() => {});
    updatePipSession({ mode });
  }, []);

  const resizeBy = useCallback((factor: number) => {
    const current = getPipSession();
    const size = sizeRef.current;
    if (current === null || size === null) return;
    const next = scalePipSize(size, factor, aspectRef.current, current.mode, screenWidthOf(childRef.current), window.innerWidth);
    if (next.width === size.width) return;
    sizeRef.current = next;
    // La largeur retenue suit la fenêtre (`onResized`).
    void invoke("pip_resize", { width: next.width, height: next.height }).catch(() => {});
  }, []);

  const gesture = useCallback((next: PipGesture | null, grab?: { x: number; y: number }) => {
    void invoke("pip_gesture", grab === undefined ? { gesture: next } : { gesture: next, grab }).catch(() => {});
  }, []);

  const onContainer = useCallback((next: HTMLElement | null, nextFrame: PipFrame) => {
    setContainer(next);
    setFrame(nextFrame);
  }, []);

  // La fenêtre a changé de taille — un coin tiré, la molette, une bascule de
  // mode : la molette repart de là, et un PiP flottant la retient.
  const onResized = useCallback((size: PipSize) => {
    if (size.width <= 0 || size.height <= 0) return;
    sizeRef.current = size;
    if (getPipSession()?.mode === "floating") rememberPipWidth(size.width);
  }, []);

  const navigateInPip = useCallback((to: string | -1, options?: NavigateOptions) => {
    // Un autre épisode reste dans le PiP ; toute autre sortie l'arrête.
    if (typeof to === "string" && to.startsWith("/watch/")) {
      updatePipSession({ location: watchLocation(to, options?.state ?? null) });
      return;
    }
    endPipSession();
  }, []);

  const value = useMemo<PictureInPicture>(() => ({
    supported: true,
    active,
    mode: session?.mode ?? DEFAULT_PIP_MODE,
    container,
    frame,
    reduce: (options) => { void reduce(options); },
    expand: () => { void expand(); },
    close,
    setMode,
    resizeBy,
    gesture,
    navigateInPip,
  }), [active, session?.mode, container, frame, reduce, expand, close, setMode, resizeBy, gesture, navigateInPip]);

  const playerLocation = onWatch ? location : session?.location ?? null;
  if (playerLocation === null) return null;
  return (
    <PictureInPictureContext.Provider value={value}>
      {/* Caché, pas démonté : en PiP, le lecteur continue de tourner sans rien peindre ici. */}
      <div style={{ display: active ? "none" : "contents" }}>
        <PlayerRoutes location={playerLocation} />
      </div>
      {/* Dès la session : la fenêtre naît pendant que le lecteur est encore là. */}
      {session !== null && sizeRef.current !== null && (
        <PipWindow
          mode={session.mode} size={sizeRef.current}
          onContainer={onContainer} onResized={onResized} onLost={onLost} onShown={leavePlayer} windowRef={childRef}
        />
      )}
    </PictureInPictureContext.Provider>
  );
}
