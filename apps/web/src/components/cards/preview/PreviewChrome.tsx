import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import { stopCardClick } from "../cardEvents";

/**
 * Le bouton du son de la mini-carte — un rond de 34 px en verre sans flou
 * (`.card-preview-mute`), en haut à droite, loin du plateau. Son libellé dit
 * le geste (« Activer le son »), pas l'état. Le clic ne remonte pas à la
 * carte : couper le son n'ouvre pas la fiche.
 */
export const PreviewMuteButton = memo(function PreviewMuteButton({
  muted,
  onToggle,
}: {
  muted: boolean;
  onToggle: () => void;
}) {
  const { t } = useTranslation("trailerPreview");
  const label = muted ? t("unmute") : t("mute");
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        stopCardClick(e);
        onToggle();
      }}
      onKeyDown={(e) => e.stopPropagation()}
      className="card-preview-mute"
    >
      {muted ? <VolumeX className="h-4 w-4" aria-hidden /> : <Volume2 className="h-4 w-4" aria-hidden />}
    </button>
  );
});

/**
 * Le titre posé sur la vidéo, en bas à gauche : le LOGO du titre quand
 * Jellyfin en annonce un (le lettrage de l'affiche, comme sur la fiche), le
 * nom sinon — et le nom aussi quand le logo ne se charge pas. Ni l'un ni
 * l'autre ne se lit deux fois : la mini-carte porte déjà le nom du titre.
 */
export const PreviewTitle = memo(function PreviewTitle({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const { broken, reportFailure } = useBrokenImage(logoUrl);
  if (logoUrl && !broken) {
    return (
      <img
        src={logoUrl}
        alt=""
        aria-hidden
        draggable={false}
        onError={reportFailure}
        className="block h-auto max-h-10 w-auto max-w-full object-contain object-left drop-shadow-[0_2px_10px_var(--on-media-shadow)]"
      />
    );
  }
  return (
    <p
      aria-hidden
      className="line-clamp-2 text-[15px] font-bold leading-tight tracking-tight text-white drop-shadow-[0_2px_8px_var(--on-media-shadow)]"
    >
      {name}
    </p>
  );
});
