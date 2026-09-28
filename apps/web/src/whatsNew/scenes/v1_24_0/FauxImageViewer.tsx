import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Place } from "../Place";
import { sceneTween } from "../sceneMotion";

interface FauxImageViewerProps {
  visible: boolean;
  title: string;
  gallery: readonly string[];
  index: number;
}

/**
 * La visionneuse d'images de la fiche (`DetailImageViewer`) : noir presque
 * plein, sans flou, l'image entière au centre, la pellicule de vignettes en
 * bas. Passer d'une image à l'autre est un fondu enchaîné — toutes les
 * images sont posées, seule leur opacité change.
 */
export function FauxImageViewer({ visible, title, gallery, index }: FauxImageViewerProps) {
  const { t } = useTranslation("media");
  const count = gallery.length;
  return (
    <Place x={0} y={0} w={640} h={360} visible={visible} scale={visible ? 1 : 1.02} transition={sceneTween} className="z-10">
      {/* La couleur de la vraie visionneuse, en dur comme chez elle : c'est un fond d'image. */}
      <div className="flex h-full w-full flex-col text-white" style={{ background: "rgba(4, 3, 8, 0.96)" }}>
        <div className="flex items-center gap-3 px-5 pb-1 pt-4">
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold">{title}</p>
            <p className="text-[9px] text-white/60">
              {t("imageKindBackdrop")}
              {count > 1 && <> · {t("imageViewerCounter", { index: index + 1, count })}</>}
            </p>
          </div>
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </span>
        </div>
        <div className="relative min-h-0 flex-1">
          {gallery.map((url, i) => (
            <motion.img
              key={url}
              src={url}
              alt=""
              draggable={false}
              className="absolute inset-x-12 inset-y-2 m-auto max-h-[calc(100%-16px)] max-w-[calc(100%-96px)] rounded-[var(--radius-md)] object-contain shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
              initial={false}
              animate={{ opacity: i === index ? 1 : 0 }}
              transition={sceneTween}
            />
          ))}
        </div>
        {count > 1 && (
          <div className="flex justify-center gap-1.5 pb-3 pt-2">
            {gallery.map((url, i) => (
              <span key={url} className="relative block h-7 w-12 overflow-hidden rounded">
                <img src={url} alt="" draggable={false} className="h-full w-full object-cover" />
                <motion.span
                  className="absolute inset-0 rounded ring-2 ring-inset ring-[var(--brand-light)]"
                  initial={false}
                  animate={{ opacity: i === index ? 1 : 0 }}
                  transition={sceneTween}
                />
                <motion.span
                  className="absolute inset-0 bg-black/50"
                  initial={false}
                  animate={{ opacity: i === index ? 0 : 1 }}
                  transition={sceneTween}
                />
              </span>
            ))}
          </div>
        )}
      </div>
    </Place>
  );
}
