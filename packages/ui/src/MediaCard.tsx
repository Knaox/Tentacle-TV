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

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      {overlay && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
          {overlay}
        </div>
      )}

      {progress !== undefined && progress > 0 && (
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
          <div
            className="h-full bg-purple-500"
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
      )}

      <div className="mt-2 px-1">
        <p className="truncate text-sm font-medium text-white">{title}</p>
        {subtitle && (
          <p className="truncate text-xs text-white/60">{subtitle}</p>
        )}
      </div>
    </motion.div>
  );
}
