import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeftIcon } from "@phosphor-icons/react/dist/csr/ArrowLeft";

interface BackButtonProps {
  /** Où aller quand il n'y a RIEN derrière (page ouverte par un lien, un favori) : l'accueil par défaut. */
  fallback?: string;
  /** Posé sur une image (fiche, bannière) : la peau des contrôles sur média. */
  onMedia?: boolean;
  /** Le texte du bouton, à côté de la flèche — sans lui, un rond et son nom accessible. */
  label?: string;
  /** Remplace le geste (un écran qui a mieux à faire que l'historique). */
  onBack?: () => void;
  className?: string;
}

/** Y a-t-il une page de l'application derrière celle-ci ? react-router numérote son historique. */
export function hasHistoryBehind(state: unknown): boolean {
  const idx = (state as { idx?: unknown } | null)?.idx;
  return typeof idx === "number" && idx > 0;
}

/**
 * Le bouton RETOUR du socle (refonte de nov. 2026) : toute page qui n'est pas une racine de
 * navigation en porte un — fiche, personne, collection, sous-page de réglages ou
 * d'administration, catalogue hors ligne, vues d'Octave, lecteur. On ne doit jamais se perdre.
 *
 * Il revient d'où l'on vient ; ouvert par un lien direct (rien derrière), il mène à `fallback`
 * plutôt que de ne rien faire. Un seul composant, pour qu'il soit partout au même endroit et de
 * la même forme : une pilule de 40 px, la flèche de Phosphor.
 */
export function BackButton({ fallback = "/", onMedia = false, label, onBack, className }: BackButtonProps) {
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const back = useCallback(() => {
    if (onBack) return onBack();
    if (hasHistoryBehind(window.history.state)) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [onBack, navigate, fallback]);
  const skin = onMedia ? "btn-on-media" : "btn-soft";

  return label ? (
    <button type="button" onClick={back} className={`btn ${skin} pl-3.5 ${className ?? ""}`}>
      <ArrowLeftIcon size={18} aria-hidden /> {label}
    </button>
  ) : (
    <button type="button" onClick={back} aria-label={t("back")} title={t("back")} className={`icon-btn ${skin} ${className ?? ""}`}>
      <ArrowLeftIcon size={20} aria-hidden />
    </button>
  );
}
