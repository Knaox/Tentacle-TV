import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";
import { CornersInIcon } from "@phosphor-icons/react/dist/csr/CornersIn";
import { CornersOutIcon } from "@phosphor-icons/react/dist/csr/CornersOut";
import { GaugeIcon } from "@phosphor-icons/react/dist/csr/Gauge";
import { PictureInPictureIcon } from "@phosphor-icons/react/dist/csr/PictureInPicture";
import { QueueIcon } from "@phosphor-icons/react/dist/csr/Queue";
import { SlidersHorizontalIcon } from "@phosphor-icons/react/dist/csr/SlidersHorizontal";
import { SpeakerHighIcon } from "@phosphor-icons/react/dist/csr/SpeakerHigh";
import { SpeakerLowIcon } from "@phosphor-icons/react/dist/csr/SpeakerLow";
import { SpeakerNoneIcon } from "@phosphor-icons/react/dist/csr/SpeakerNone";
import { SpeakerXIcon } from "@phosphor-icons/react/dist/csr/SpeakerX";
import { PauseIcon as PauseBase, PlayIcon as PlayBase, SkipBackIcon, SkipForwardIcon } from "./icons/transport";

// Icônes des contrôles du lecteur, tous superposés à la vidéo → text-white
// volontairement en dur dans les deux thèmes clair/sombre.
//
// Les NOMS d'avant, dessinés par Phosphor (refonte de nov. 2026). Le transport — lire, pause,
// précédent, suivant — est toujours PLEIN (`icons/transport`) ; le reste est au trait.
const SMALL = "h-5 w-5 text-white";

export function BackIcon() { return <ArrowLeftIcon className="h-6 w-6 text-white" aria-hidden />; }
export function PlayIcon() { return <PlayBase className="h-7 w-7 text-white" aria-hidden />; }
export function PauseIcon() { return <PauseBase className="h-7 w-7 text-white" aria-hidden />; }
/** Le haut-parleur et ses ondes : une, deux ou trois « barres » selon le volume. */
export function VolumeIcon({ bars = 3 }: { bars?: 1 | 2 | 3 }) {
  const Icon = bars >= 3 ? SpeakerHighIcon : bars === 2 ? SpeakerLowIcon : SpeakerNoneIcon;
  return <Icon className={SMALL} aria-hidden />;
}
export function MuteIcon() { return <SpeakerXIcon className={SMALL} aria-hidden />; }
export function GearIcon() { return <SlidersHorizontalIcon className={SMALL} aria-hidden />; }
export function FullscreenIcon() { return <CornersOutIcon className={SMALL} aria-hidden />; }
export function ExitFullscreenIcon() { return <CornersInIcon className={SMALL} aria-hidden />; }
export function PrevEpIcon() { return <SkipBackIcon className={SMALL} aria-hidden />; }
export function NextEpIcon() { return <SkipForwardIcon className={SMALL} aria-hidden />; }
export function PipIcon() { return <PictureInPictureIcon className={SMALL} aria-hidden />; }
export function EpisodesIcon() { return <QueueIcon className={SMALL} aria-hidden />; }
export function SpeedIcon() { return <GaugeIcon className={SMALL} aria-hidden />; }
