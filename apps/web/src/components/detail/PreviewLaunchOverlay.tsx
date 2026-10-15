import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { DETAIL_STAGE_BOX, DETAIL_STAGE_FOCUS, DETAIL_STAGE_LAYERS } from "./detailStageGeometry";
import { DetailStageFallback } from "./DetailArtworkFallback";
import { launchFromTransform, stageCoverRect, type LaunchBox } from "./previewLaunchGeometry";
import type { PreviewLaunch } from "./previewLaunch";
import { useDecodedImage } from "./useDecodedImage";

interface PreviewLaunchOverlayProps {
  launch: PreviewLaunch;
  /** Le décor de la fiche — celui que la scène peindra dessous. */
  backdropUrl: string | null;
  /** La fiche est rendue (requête revenue) : le calque peut la découvrir. */
  settled: boolean;
  onDone: () => void;
}

/**
 * Le tempo — une course franche qui se pose (même courbe que l'ouverture
 * depuis une carte), un décor qui prend le relais AVANT l'arrêt complet, une
 * sortie plus courte que l'entrée.
 */
const FLIGHT_S = 0.44;
/** À 60 % du temps, la courbe a parcouru ~97 % du chemin : le décor peut fondre dessus. */
const LANDING_AT = 0.6;
const BASE_S = 0.24;
const DECOR_S = 0.34;
const EXIT_S = 0.22;
const SETTLE = [0.16, 1, 0.3, 1] as const;
/** Le décor tarde (réseau) : la fiche se découvre quand même — l'image de l'aperçu a tenu la place. */
const DECOR_WAIT_MS = 1500;
/** Jamais l'écran gardé : requête en échec, fiche qui ne vient pas. */
const MAX_HOLD_MS = 4000;

/** Le canevas copié de la vidéo, posé tel quel : aucune recopie, aucune requête. */
function FrameCanvas({ canvas }: { canvas: HTMLCanvasElement }) {
  const slotRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    canvas.style.cssText = "display:block;width:100%;height:100%";
    slotRef.current?.appendChild(canvas);
  }, [canvas]);
  return <div ref={slotRef} className="h-full w-full" />;
}

/**
 * Ouverture de la fiche DEPUIS LA MINI-CARTE D'APERÇU (`previewLaunch.ts`).
 *
 * Ce qu'on regardait grandit : l'image de la vidéo part de sa place dans la
 * mini-carte et COUVRE la scène de la fiche, cadrée comme son décor
 * (`stageCoverRect`) — en `transform` seulement, posée à sa place finale et
 * ramenée au départ par une échelle uniforme. Pendant ce temps la page quittée
 * s'assombrit autour d'elle et les voiles de la scène se posent dessus. Le
 * décor de la fiche, DÉCODÉ avant d'être montré (`useDecodedImage`), fond
 * ensuite sur l'image de l'aperçu ; puis le calque s'efface sur une scène
 * identique, et ne reste que le texte de la fiche qui apparaît.
 *
 * Jamais une image noire : tant que le décor n'est pas prêt, l'image de
 * l'aperçu tient la place, en grand. Rien ne reste monté après : le calque se
 * retire, le canevas est vidé.
 *
 * Animations réduites : rien ne vole, la fiche apparaît (comme l'ouverture
 * depuis une carte).
 */
export function PreviewLaunchOverlay({ launch, backdropUrl, settled, onDone }: PreviewLaunchOverlayProps) {
  const reduced = useReducedMotion();
  const [playing, setPlaying] = useState(true);
  const stageRef = useRef<HTMLDivElement>(null);
  const [stage, setStage] = useState<LaunchBox | null>(null);
  const [landing, setLanding] = useState(false);
  const [decorShown, setDecorShown] = useState(false);
  const [gaveUp, setGaveUp] = useState(false);
  const backdrop = useDecodedImage(reduced ? null : backdropUrl);

  // Mesurée avant la première peinture : l'image part de la mini-carte dès la première image.
  useLayoutEffect(() => {
    const r = stageRef.current?.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) setStage({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, []);

  useEffect(() => {
    if (reduced) onDone();
  }, [reduced, onDone]);

  useEffect(() => {
    const landingTimer = setTimeout(() => setLanding(true), FLIGHT_S * LANDING_AT * 1000);
    const holdTimer = setTimeout(() => setPlaying(false), MAX_HOLD_MS);
    return () => {
      clearTimeout(landingTimer);
      clearTimeout(holdTimer);
    };
  }, []);

  useEffect(() => {
    if (!landing || !settled || backdrop !== "pending") return;
    const timer = setTimeout(() => setGaveUp(true), DECOR_WAIT_MS);
    return () => clearTimeout(timer);
  }, [landing, settled, backdrop]);

  useEffect(() => {
    if (gaveUp || (decorShown && settled)) setPlaying(false);
  }, [gaveUp, decorShown, settled]);

  if (reduced) return null;

  // Le décor qui prend le relais : l'image de la fiche décodée, ou le repli de
  // la scène quand la fiche n'en a pas (ou qu'elle est cassée).
  const decor = backdrop === "ready" ? "image" : settled && (backdrop === "none" || backdrop === "failed") ? "fallback" : null;
  const showDecor = landing && decor !== null;
  const cover = stage ? stageCoverRect(stage, launch.rect.width / launch.rect.height) : null;
  const from = stage && cover
    ? launchFromTransform({ ...launch.rect, left: launch.rect.left - stage.left, top: launch.rect.top - stage.top }, cover)
    : null;

  const finish = () => {
    // Le canevas (jusqu'à 1280 × 720) ne survit pas au calque.
    if (launch.frame) {
      launch.frame.width = 0;
      launch.frame.height = 0;
    }
    onDone();
  };

  return createPortal(
    <AnimatePresence onExitComplete={finish}>
      {playing && (
        <motion.div
          className="pointer-events-none fixed inset-0 z-[60]"
          aria-hidden
          exit={{ opacity: 0, transition: { duration: EXIT_S, ease: "easeOut" } }}
        >
          {/* La page quittée s'assombrit autour de l'image qui grandit. */}
          <motion.div
            className="absolute inset-0 bg-surface-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: BASE_S, ease: "easeOut" }}
          />
          {/* La MÊME boîte que la scène de la fiche (`DetailStage`) : à l'effacement, rien ne bouge. */}
          <div ref={stageRef} className={`absolute inset-x-0 top-0 overflow-hidden ${DETAIL_STAGE_BOX}`}>
            {cover && from && (
              <motion.div
                data-preview-launch
                className="absolute overflow-hidden"
                style={{ left: cover.left, top: cover.top, width: cover.width, height: cover.height, transformOrigin: "0 0" }}
                initial={{ x: from.x, y: from.y, scale: from.scale }}
                animate={{ x: 0, y: 0, scale: 1 }}
                transition={{ duration: FLIGHT_S, ease: SETTLE }}
              >
                {launch.frame ? (
                  <FrameCanvas canvas={launch.frame} />
                ) : (
                  <img src={launch.stillUrl ?? undefined} alt="" draggable={false} className="h-full w-full object-cover" />
                )}
              </motion.div>
            )}
            <motion.div
              className="absolute inset-0"
              initial={{ opacity: 0 }}
              animate={{ opacity: showDecor ? 1 : 0 }}
              transition={{ duration: DECOR_S, ease: "easeOut" }}
              onAnimationComplete={(definition) => {
                if ((definition as { opacity?: number }).opacity === 1) setDecorShown(true);
              }}
            >
              {decor === "image" && backdropUrl && (
                <img
                  src={backdropUrl}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 h-full w-full object-cover"
                  style={{ objectPosition: DETAIL_STAGE_FOCUS }}
                />
              )}
              {decor === "fallback" && <DetailStageFallback />}
            </motion.div>
            {/* Les voiles de la scène, dans son ordre : ils se posent sur l'image en vol. */}
            {DETAIL_STAGE_LAYERS.map((layer) => (
              <motion.div
                key={layer.background}
                className={layer.className}
                style={{ background: layer.background }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: FLIGHT_S * 0.7, delay: FLIGHT_S * 0.3, ease: "easeOut" }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
