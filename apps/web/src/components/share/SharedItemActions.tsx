import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { PlayIcon } from "../media/MediaDetailIcons";
import { fadeUp } from "../../theme/motion";

interface Props {
  itemId: string;
  authed: boolean;
  loginPath: string;
  ownerUsername?: string;
}

const PRIMARY =
  "inline-flex h-12 items-center gap-2.5 rounded-xl px-6 text-sm font-bold text-cta-brand-fg shadow-[0_8px_24px_-8px_rgba(var(--brand-rgb),0.55)] transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)] focus-visible:ring-offset-2 focus-visible:ring-offset-surface-0 motion-reduce:hover:translate-y-0";

/**
 * Les actions de la fiche partagée, à la place de « Lecture » : un seul geste
 * principal, qui MÈNE à la lecture sans la promettre ici. Visiteur : se
 * connecter (retour sur ce partage ensuite). Connecté : ouvrir la vraie fiche,
 * où tout le reste l'attend. Dessous, ce que la page est — un aperçu partagé.
 */
export const SharedItemActions = memo(function SharedItemActions({ itemId, authed, loginPath, ownerUsername }: Props) {
  const { t } = useTranslation("share");
  return (
    <motion.div variants={fadeUp} className="mt-6">
      <Link
        to={authed ? `/media/${itemId}` : loginPath}
        className={PRIMARY}
        style={{ background: "linear-gradient(135deg, var(--brand), var(--brand-accent))" }}
      >
        <PlayIcon />
        {authed ? t("openDetail") : t("signInToWatch")}
      </Link>
      <p className="mt-3 max-w-xl text-sm leading-relaxed text-content-tertiary">
        {ownerUsername && <span className="font-medium text-content-secondary">{t("itemFrom", { name: ownerUsername })} · </span>}
        {t("itemPreviewNote")}
      </p>
    </motion.div>
  );
});
