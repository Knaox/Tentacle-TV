import { FilePlay, Film, Globe, Smartphone, Tv, type LucideIcon } from "lucide-react";
import type { TrailerGuideIcon } from "@tentacle-tv/shared";

/**
 * Les pictogrammes du guide, dessinés avec le jeu du web (lucide). Le modèle
 * partagé ne donne que leur SENS ; le mobile a sa propre table (Feather), qui
 * suit la même correspondance.
 */
export const GUIDE_ICONS: Record<TrailerGuideIcon, LucideIcon> = {
  file: FilePlay,
  globe: Globe,
  film: Film,
  smartphone: Smartphone,
  tv: Tv,
};
