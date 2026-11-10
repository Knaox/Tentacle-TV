import { FileVideoIcon as FilePlay } from "@phosphor-icons/react/dist/csr/FileVideo";
import { FilmStripIcon as Film } from "@phosphor-icons/react/dist/csr/FilmStrip";
import { GlobeIcon as Globe } from "@phosphor-icons/react/dist/csr/Globe";
import { DeviceMobileIcon as Smartphone } from "@phosphor-icons/react/dist/csr/DeviceMobile";
import { TelevisionIcon as Tv } from "@phosphor-icons/react/dist/csr/Television";
import type { Icon as IconType } from "@phosphor-icons/react";
import type { TrailerGuideIcon } from "@tentacle-tv/shared";

/**
 * Les pictogrammes du guide, dessinés avec le jeu du web (Phosphor). Le modèle
 * partagé ne donne que leur SENS ; le mobile a sa propre table (Feather), qui
 * suit la même correspondance.
 */
export const GUIDE_ICONS: Record<TrailerGuideIcon, IconType> = {
  file: FilePlay,
  globe: Globe,
  film: Film,
  smartphone: Smartphone,
  tv: Tv,
};
