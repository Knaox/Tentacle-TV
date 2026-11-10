import { memo, useState } from "react";
import { lucideIconFor } from "../lucideIcon";
import { iconImageUrl, monogram } from "./pluginCatalog";

interface PluginIconProps {
  name: string;
  /** L'icône publiée par le registre (adresse d'image) — filtrée : http(s) ou data:image. */
  image?: string;
  /** L'icône Lucide de la navigation du plugin (« compass »…), quand il est installé. */
  lucide?: string | null;
  size?: "md" | "lg";
  /** Plugin désactivé : la tuile pâlit, comme l'onglet qu'il a quitté. */
  muted?: boolean;
}

const SIZE = {
  md: { box: "h-11 w-11 rounded-card text-base", icon: "h-5 w-5" },
  lg: { box: "h-16 w-16 rounded-tile text-2xl", icon: "h-7 w-7" },
} as const;

/**
 * La tuile d'un plugin : l'image de son registre, sinon l'icône qu'il montre
 * dans la navigation, sinon son initiale — sur une plaque d'encre neutre. Le
 * registre officiel ne publie pas d'image (`icon: ""`) : sans ce repli, toutes
 * les cartes se ressembleraient.
 *
 * Une image qui ne charge pas retombe sur le repli au lieu d'un cadre vide.
 * `referrerPolicy="no-referrer"` : l'hôte d'une source tierce n'apprend pas
 * l'adresse du serveur Tentacle qui l'affiche.
 */
export const PluginIcon = memo(function PluginIcon({ name, image, lucide, size = "md", muted = false }: PluginIconProps) {
  const [broken, setBroken] = useState<string | null>(null);
  const src = iconImageUrl(image);
  const dims = SIZE[size];
  const Icon = lucideIconFor(lucide);
  const tone = muted ? "opacity-60 grayscale" : "";

  if (src && broken !== src) {
    return (
      <span aria-hidden className={`flex shrink-0 overflow-hidden bg-surface-3 ${dims.box} ${tone}`}>
        <img
          src={src}
          alt=""
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setBroken(src)}
          className="h-full w-full object-cover"
        />
      </span>
    );
  }

  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center bg-surface-3 font-display font-bold text-content-primary ${dims.box} ${tone}`}
    >
      {Icon ? <Icon className={dims.icon} /> : monogram(name)}
    </span>
  );
});
