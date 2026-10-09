import { createPortal } from "react-dom";
import { usePictureInPicture } from "./pictureInPictureContext";
import { PipControls } from "./PipControls";

type PipControlsProps = Parameters<typeof PipControls>[0];

/**
 * Les contrôles du PiP, rendus par le lecteur dans la fenêtre PiP — seulement
 * pendant le PiP, et une fois sa fenêtre ouverte. Le lecteur reste maître de
 * ses gestes : le portail ne fait que les porter dans l'autre fenêtre.
 */
export function PlayerPipPortal(props: PipControlsProps) {
  const pip = usePictureInPicture();
  if (!pip.active || pip.container === null) return null;
  return createPortal(<PipControls {...props} />, pip.container);
}
