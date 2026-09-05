import { motion } from "framer-motion";
import { Place, type Animated, type Placed } from "./Place";
import { easeOut } from "../../theme/motion";

interface FauxStarsProps extends Placed, Animated {
  /** 0..5 étoiles allumées. */
  value: number;
  size?: number;
  gap?: number;
}

const STAR = "M12 2.5l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.3l-6 3.3 1.3-6.6L2.4 9.4l6.7-.8L12 2.5z";

/** Cinq étoiles : un contour permanent, un plein qui « pope » à l'allumage. */
export function FauxStars({ value, size = 18, gap = 3, ...place }: FauxStarsProps) {
  return (
    <Place {...place} w={5 * size + 4 * gap} h={size}>
      <span className="flex" style={{ gap }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const filled = i < value;
          return (
            <span key={i} className="relative block" style={{ width: size, height: size }}>
              <svg
                viewBox="0 0 24 24"
                className="absolute inset-0 h-full w-full text-[var(--brand-accent)]"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.8}
              >
                <path d={STAR} strokeLinejoin="round" />
              </svg>
              <motion.svg
                viewBox="0 0 24 24"
                className="absolute inset-0 h-full w-full text-[var(--brand-accent)]"
                fill="currentColor"
                initial={false}
                animate={{ opacity: filled ? 1 : 0, scale: filled ? [1.4, 1] : 0.7 }}
                transition={{ duration: 0.35, ease: easeOut, delay: filled ? i * 0.05 : 0 }}
              >
                <path d={STAR} />
              </motion.svg>
            </span>
          );
        })}
      </span>
    </Place>
  );
}
