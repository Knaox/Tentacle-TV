import { motion } from "framer-motion";
import type { ReactNode } from "react";

interface MediaCardProps {
  imageUrl: string;
  title: string;
  subtitle?: string;
  progress?: number;
  onClick?: () => void;
  overlay?: ReactNode;
}

export function MediaCard({
  imageUrl,
  title,
  subtitle,
  progress,
  onClick,
  overlay,
}: MediaCardProps) {
  return (
    <motion.div
      whileHover={{ scale: 1.05, y: -4 }}
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-xl"
    >
      <div className="aspect-[2/3] w-full">
        <img
          src={imageUrl}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-110"
        />
      </div>

      {/* Scrim posé SUR l'affiche : reste noir dans les deux schémas — la
          luminosité d'un poster ne dépend pas du thème choisi. Volontairement
          non tokenisé (famille « sur média »), comme --on-media-*. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          {overlay}
        </div>
      )}

      {progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20" /* piste sur l'affiche — reste claire dans les 2 schémas */>
          <div
            className="h-full bg-[var(--brand)]"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}

      <div className="mt-2 px-1">
        {/* Ce bloc est SOUS l'affiche, sur le fond de page : il suit le schéma. */}
        <p className="truncate text-sm font-medium text-content-primary">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-content-tertiary">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}
