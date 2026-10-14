import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import { stopCardClick } from "../cardEvents";

/**
 * Le bouton du son de la mini-carte — un rond cerclé, sans flou, en haut à
 * droite de la vidéo, loin des actions (`.card-preview-mute`, à l'échelle de
 * la mini-carte). Son libellé dit le geste (« Activer le son »), pas l'état.
 * Le clic ne remonte pas à la carte : couper le son n'ouvre pas la fiche (les
 * touches, elles, sont arrêtées par la mini-carte entière).
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
      className="card-preview-mute"
    >
      {muted ? <VolumeX aria-hidden strokeWidth={2} /> : <Volume2 aria-hidden strokeWidth={2} />}
    </button>
  );
});

/**
 * Le titre du bandeau : le LOGO du titre quand Jellyfin en annonce un (le
 * lettrage de l'affiche, comme sur la fiche), le nom sinon — et le nom aussi
 * quand le logo ne se charge pas. Ni l'un ni l'autre ne se lit deux fois : la
 * mini-carte porte déjà le nom du titre (`aria-label`).
 *
 * Le logo tient dans une hauteur (`--pv-logo-h`) et dans sa ligne : un
 * lettrage très large se réduit, il ne repousse jamais les étoiles hors de la
 * mini-carte. Son image posée — ou cassée, le nom prenant sa place — se
 * signale (`onSettled`) : le bandeau remesure son air (`usePanelAir`).
 */
export const PreviewTitle = memo(function PreviewTitle({
  name,
  logoUrl,
  onSettled,
}: {
  name: string;
  logoUrl: string | null;
  onSettled?: () => void;
}) {
  const { broken, reportFailure } = useBrokenImage(logoUrl);
  return (
    <div className="card-preview-title">
      {logoUrl && !broken ? (
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          draggable={false}
          onLoad={onSettled}
          onError={() => {
            reportFailure();
            onSettled?.();
          }}
          className="card-preview-logo"
        />
      ) : (
        <p aria-hidden className="card-preview-name">
          {name}
        </p>
      )}
    </div>
  );
});
