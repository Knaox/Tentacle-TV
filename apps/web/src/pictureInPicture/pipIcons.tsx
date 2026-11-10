import { ArrowSquareDownRightIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareDownRight";
import { ArrowSquareOutIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareOut";
import { ArrowSquareUpLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowSquareUpLeft";
import { PictureInPictureIcon } from "@phosphor-icons/react/dist/csr/PictureInPicture";
import { XIcon } from "@phosphor-icons/react/dist/csr/X";

/**
 * Les pictos du PiP — le jeu du lecteur (`PlayerIcons.tsx`) : Phosphor au trait,
 * `currentColor`, blancs sur la vidéo dans les deux thèmes.
 */

/** Le picto PiP standard : un écran, et la petite fenêtre dans son coin. */
export function ReduceIcon() {
  return <PictureInPictureIcon className="h-5 w-5" aria-hidden />;
}

/** Revenir au lecteur : la flèche qui sort du cadre. */
export function ExpandIcon() {
  return <ArrowSquareOutIcon className="h-4 w-4" aria-hidden />;
}

export function CloseIcon() {
  return <XIcon className="h-4 w-4" aria-hidden />;
}

/** Épingler dans le coin de l'application : la flèche vers le coin. */
export function DockIcon() {
  return <ArrowSquareDownRightIcon className="h-4 w-4" aria-hidden />;
}

/** Détacher : la flèche qui s'en éloigne. */
export function UndockIcon() {
  return <ArrowSquareUpLeftIcon className="h-4 w-4" aria-hidden />;
}
