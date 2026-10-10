import { memo, Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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

/**
 * Après une naissance ou une bascule de mode, la coquille anime encore la
 * fenêtre (280 ms au plus, `pipMotion.ts`) : ces tailles-là ne sont pas un
 * choix de l'utilisateur, rien n'est retenu avant ce délai.
 */
const PIP_SETTLE_MS = 700;

function pathOf(location: Location): string {
  return `${location.pathname}${location.search}${location.hash}`;
}

export function PlayerStage() {
  const location = useLocation();
  const navigate = useNavigate();
  const session = usePipSession();
  const onWatch = location.pathname.startsWith("/watch/");
  // Fermée par nous pour revenir au lecteur : ce n'est pas une perte.
  const expandingRef = useRef(false);
  /**
   * Une lecture lancée PENDANT le PiP — une fiche, une carte, une autre
   * lecture — s'y joue, et le PiP reste ouvert, comme sur YouTube (retour de
   * Damien) : une route du lecteur neuve qui n'est ni celle que le PiP garde,
   * ni le retour au lecteur. Le lecteur ne se montre pas en grand pour autant.
   */
  const launching = session !== null && onWatch && location.key !== session.location.key && !expandingRef.current;
  /**
   * La route de la lecture lancée, tant que le retour à la page parcourue
   * n'est pas validé : React Router navigue en TRANSITION (rendu différé), et
   * la session mise à jour en premier rendrait le lecteur en grand une image.
   */
  const launchedKeyRef = useRef<string | null>(null);
  const active = session !== null && (!onWatch || launching || location.key === launchedKeyRef.current);
  // La dernière page parcourue hors du lecteur : celle qu'une lecture lancée
  // pendant le PiP rend aussitôt.
  const lastPageRef = useRef<Location | null>(null);
  useEffect(() => { if (!onWatch) lastPageRef.current = location; }, [onWatch, location]);
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const [frame, setFrame] = useState<PipFrame>({ shadow: 0, bezel: 0 });
  const childRef = useRef<Window | null>(null);
  const sizeRef = useRef<PipSize | null>(null);
  const aspectRef = useRef(16 / 9);
  // Le retour au lecteur en cours : à finir une fois sa route validée.
  const returnRef = useRef<{ restoreFullscreen: boolean } | null>(null);
  // Réduire : la page ne quitte le lecteur qu'une fois la vidéo dans le PiP.
  const leavingRef = useRef(false);
  /**
   * Jusqu'à cet instant (`performance.now()`), la taille du PiP change par
   * nous — naissance, bascule de mode, retour au lecteur — et ne se retient
   * pas. Le retour au lecteur faisait grandir le PiP flottant jusqu'au
   * lecteur : sa taille devenait « la largeur choisie », et le PiP suivant
   * naissait à 60 % de l'écran (retour de Damien).
   */
  const settleUntilRef = useRef(Number.POSITIVE_INFINITY);

  // La lecture lancée passe au PiP, et la page rend AVANT d'être peinte celle
  // qu'on parcourait (`replace` : synchrone, là où `navigate(-1)` laisserait
  // voir une image de la route du lecteur, vide hors du PiP).
  useLayoutEffect(() => {
    if (!launching) return;
    launchedKeyRef.current = location.key;
    updatePipSession({ location, launched: true });
    const back = lastPageRef.current;
    if (back !== null) void navigate(pathOf(back), { replace: true, state: back.state });
    else void navigate(-1);
  }, [launching, location, navigate]);

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

  // Le PiP à l'écran : il gagne son coin, puis sa taille est celle de l'utilisateur.
  const onShown = useCallback(() => {
    settleUntilRef.current = performance.now() + PIP_SETTLE_MS;
    leavePlayer();
  }, [leavePlayer]);

  const reduce = useCallback(async ({ restoreFullscreen }: { restoreFullscreen: boolean }) => {
    if (!location.pathname.startsWith("/watch/") || getPipSession() !== null) return;
    const mode = DEFAULT_PIP_MODE;
    const raw = await getMpvApi()?.getProperty("video-params/aspect", "double").catch(() => null);
    aspectRef.current = pipAspect(raw);
    sizeRef.current = initialPipSize(mode, aspectRef.current, window.screen.availWidth, window.innerWidth, rememberedPipWidth());
    settleUntilRef.current = Number.POSITIVE_INFINITY;
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
    settleUntilRef.current = Number.POSITIVE_INFINITY;
    updatePipSession({ returning: true });
    // L'image regagne d'abord sa place dans le lecteur (la coquille l'anime ;
    // rien sous Linux, où la commande rend la main aussitôt).
    try { await invoke("pip_restore"); } catch { /* retour sans animation */ }
    let fullscreen = false;
    try { fullscreen = await invoke<boolean>("player_fullscreen_enter"); } catch { /* fenêtré */ }
    // Le lecteur reparaît SOUS le PiP, qui garde l'image au même endroit ; le
    // PiP se ferme une fois la route du lecteur VALIDÉE et peinte
    // (`returnRef`, effet ci-dessous) — jamais la vidéo rendue à une page
    // encore opaque.
    returnRef.current = { restoreFullscreen: current.restoreFullscreen && !fullscreen };
    void navigate(pathOf(current.location), { state: current.location.state });
  }, [navigate]);

  /**
   * La fin du retour au lecteur, une fois sa route VALIDÉE. React Router
   * navigue en transition : finir la session deux images après `navigate`
   * (comme avant) laissait parfois React la traiter AVANT la navigation, la
   * route encore sur la page parcourue — le lecteur se démontait, puis
   * remontait de zéro : un écran de chargement et une lecture relancée
   * (« arrêt du précédent … relance de la page », 2 retours sur 9 au banc).
   */
  useEffect(() => {
    const pending = returnRef.current;
    if (pending === null || !onWatch) return;
    returnRef.current = null;
    let second = 0;
    const first = window.requestAnimationFrame(() => {
      second = window.requestAnimationFrame(() => {
        endPipSession();
        expandingRef.current = false;
        if (pending.restoreFullscreen) void invoke("toggle_fullscreen").catch(() => {});
      });
    });
    return () => { window.cancelAnimationFrame(first); window.cancelAnimationFrame(second); };
  }, [onWatch, location.key]);

  const close = useCallback(() => { endPipSession(); }, []);

  const onLost = useCallback(() => {
    if (!expandingRef.current) endPipSession();
  }, []);

  // Détaché ou rangé, le PiP garde sa taille : celle choisie, sinon l'actuelle.
  const setMode = useCallback((mode: PipMode) => {
    const size = initialPipSize(
      mode, aspectRef.current, screenWidthOf(childRef.current), window.innerWidth,
      rememberedPipWidth() ?? sizeRef.current?.width ?? null,
    );
    sizeRef.current = size;
    settleUntilRef.current = performance.now() + PIP_SETTLE_MS;
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
    rememberPipWidth(next.width);
    void invoke("pip_resize", { width: next.width, height: next.height }).catch(() => {});
  }, []);

  const gesture = useCallback((next: PipGesture | null, grab?: { x: number; y: number }) => {
    void invoke("pip_gesture", grab === undefined ? { gesture: next } : { gesture: next, grab }).catch(() => {});
  }, []);

  const onContainer = useCallback((next: HTMLElement | null, nextFrame: PipFrame) => {
    setContainer(next);
    setFrame(nextFrame);
  }, []);

  // La fenêtre a changé de taille — un coin tiré, les bords du système, la
  // molette, une animation de la coquille : la molette repart de là, et la
  // taille se retient pour le prochain PiP si c'est l'utilisateur qui l'a
  // choisie (`settleUntilRef`), dans les deux modes.
  const onResized = useCallback((size: PipSize) => {
    if (size.width <= 0 || size.height <= 0) return;
    sizeRef.current = size;
    if (getPipSession() !== null && performance.now() >= settleUntilRef.current) rememberPipWidth(size.width);
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

  // Pendant `launching`, `location` est déjà la lecture lancée : le lecteur
  // la charge DANS le PiP, la même instance — comme un épisode suivant.
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
          onContainer={onContainer} onResized={onResized} onLost={onLost} onShown={onShown} windowRef={childRef}
        />
      )}
    </PictureInPictureContext.Provider>
  );
}
