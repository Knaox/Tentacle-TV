import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeftIcon } from "../media/MediaDetailIcons";

interface DetailHeroProps {
  backdropUrl: string | null;
}

/**
 * Cinematic backdrop hero for the media detail page.
 * Includes a translucent back button + ken-burns crossfade entry.
 */
export function DetailHero({ backdropUrl }: DetailHeroProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  return (
    <div className="relative h-[70vh] w-full overflow-hidden md:h-[78vh]">
      <button
        type="button"
        onClick={() => navigate(-1)}
        aria-label={t("common:back")}
        className="absolute left-4 top-4 z-20 flex items-center gap-2 rounded-full border border-white/15 bg-black/45 px-4 py-2 text-sm text-white/85 backdrop-blur-md transition-all hover:bg-black/65 hover:text-white md:left-8 md:top-8"
      >
        <ArrowLeftIcon />
        {t("common:back")}
      </button>

      {backdropUrl && (
        <motion.img
          src={backdropUrl}
          alt=""
          draggable={false}
          initial={{ opacity: 0, scale: 1.12 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
          className="absolute inset-0 h-full w-full object-cover animate-ken-burns"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {/* Cinematic gradient stack */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.35) 45%, transparent 70%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 55%, var(--surface-0) 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,0.55) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
