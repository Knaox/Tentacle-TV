import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { ArrowLeftIcon } from "../media/MediaDetailIcons";

interface DetailHeroProps {
  backdropUrl: string | null;
}

/**
 * Cinematic backdrop hero for the media detail page.
 * Includes a translucent back button + ken-burns zoom (32s ease-out alternate).
 * La qualité (4K / HDR / Dolby) n'est PAS affichée ici : elle vit à côté du
 * titre (DetailMetadata) pour ne pas surcharger la bannière.
 */
export function DetailHero({ backdropUrl }: DetailHeroProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");

  // Bouton retour + dégradés posés directement SUR le backdrop : restent en
  // blanc/noir dans les deux thèmes (cf. règle « posé sur média »).
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
          className="absolute inset-0 h-full w-full object-cover animate-ken-burns motion-reduce:animate-none"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}

      {/* Pile de degrades — chaines completes dans index.css
          (`--detail-scrim-*`), geometrie distincte par schema : en clair la
          couture basse porte la lisibilite du bloc titre, l'affiche au-dessus
          reste quasi propre. En sombre, valeurs historiques inchangees. */}
      {/* Flou progressif vertical (clair uniquement) — cf. index.css .detail-glass */}
      <div className="detail-glass detail-glass-1 absolute inset-x-0 bottom-0 h-[70%]" />
      <div className="detail-glass detail-glass-2 absolute inset-x-0 bottom-0 h-[70%]" />
      <div className="detail-glass detail-glass-3 absolute inset-x-0 bottom-0 h-[70%]" />
      <div className="absolute inset-0" style={{ background: "var(--detail-scrim-left)" }} />
      <div
        className="absolute inset-x-0 bottom-0 h-[55%]"
        style={{ background: "var(--detail-scrim-bottom)" }}
      />
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{ background: "var(--detail-scrim-top)" }}
      />
    </div>
  );
}
