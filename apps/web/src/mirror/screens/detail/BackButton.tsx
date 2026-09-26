import { memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";

/**
 * `backOrHome` de l'app : on dépile quand il y a de quoi (le routeur range son
 * index dans `history.state.idx`), sinon l'accueil — une fiche ouverte par
 * lien direct n'a rien derrière elle.
 */
export function useBackOrHome(): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate("/", { replace: true });
  }, [navigate]);
}

/**
 * Le bouton retour de la fiche (`IconButton icon="←"` de l'app) : rond, icône
 * à la moitié du diamètre, se tasse à 0,9 sous le doigt. Téléphone 36 sur
 * `glass.backdrop` ; iPad paysage 42 sur `glass.tintStrong`, bordé
 * `border.strong` pour rester lisible sur un visuel clair.
 */
export const BackButton = memo(function BackButton({ large = false }: { large?: boolean }) {
  const { t } = useTranslation("common");
  const onBack = useBackOrHome();
  const size = large ? 42 : 36;
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label={t("back")}
      className={`mirror-press flex shrink-0 items-center justify-center rounded-full text-content-primary ${
        large ? "border border-line-strong bg-glass-tint-strong" : "bg-glass-backdrop"
      }`}
      style={{ width: size, height: size, WebkitTapHighlightColor: "transparent" }}
    >
      <ArrowLeft size={Math.round(size * 0.5)} aria-hidden />
    </button>
  );
});
