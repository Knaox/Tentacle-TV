import type { MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { PlayIcon } from "../icons/HeroIcons";
import { PressableScale } from "../ui/PressableScale";
import type { RecoPlayTarget } from "./useRecoPlayTarget";

interface RecoCardPlayButtonProps {
  target: RecoPlayTarget;
  /** Ouverture de la fiche AVEC sa transition — repli quand rien n'est lançable. */
  onOpenDetail: () => void;
}

/**
 * Le bouton Lecture du voile : le disque blanc de PosterTile, et sa légende
 * (« Reprendre S2 · E5 »). Jamais désactivé : un bouton grisé sous le curseur
 * le temps de la résolution clignoterait ; le code d'épisode s'ajoute quand il
 * arrive, et un clic trop tôt ouvre la fiche, qui fait la même résolution.
 * `stopPropagation` : la carte entière est un bouton qui ouvre la fiche et
 * capture l'origine de sa transition — lire ne doit faire ni l'un ni l'autre.
 */
export function RecoCardPlayButton({ target, onOpenDetail }: RecoCardPlayButtonProps) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();

  const handleClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    e.preventDefault();
    if (target.kind === "detail") onOpenDetail();
    else navigate(target.path);
  };

  return (
    <PressableScale
      onClick={handleClick}
      aria-label={target.label}
      title={target.label}
      className="flex max-w-full items-center gap-2 self-start text-left"
    >
      <span
        aria-hidden
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-cta-primary-border bg-cta-primary-bg text-cta-primary-fg"
        style={{ boxShadow: "var(--elev-2)" }}
      >
        <PlayIcon />
      </span>
      {/* Une seule ligne, tronquée s'il le faut — jamais repliée sur deux. */}
      <span aria-hidden className="min-w-0 truncate whitespace-nowrap text-[11px] font-semibold leading-none text-white">
        {t(target.labelKey)}
        {target.episodeCode && <span className="font-normal text-white/70"> {target.episodeCode}</span>}
      </span>
    </PressableScale>
  );
}
