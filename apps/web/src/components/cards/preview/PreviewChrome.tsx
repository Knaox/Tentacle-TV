import { memo, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Volume2, VolumeX } from "lucide-react";
import { useBrokenImage } from "../../../hooks/useBrokenImage";
import { stopCardClick } from "../cardEvents";

/**
 * Le SON de la mini-carte, en haut à droite de la vidéo, loin des actions :
 * un rond cerclé, sans flou (`.card-preview-mute`, à l'échelle de la
 * mini-carte), et, à son survol ou à son focus, la réglette du volume qui se
 * déplie à sa gauche (`.card-preview-volume` — opacité et échelle seulement).
 * Couper, rendre et régler le volume sont retenus sur l'appareil pour les
 * aperçus suivants. Le libellé du bouton dit le geste (« Activer le son »),
 * pas l'état. Rien ne remonte à la carte : régler le son n'ouvre pas la fiche.
 */
export const PreviewSoundControl = memo(function PreviewSoundControl({
  muted,
  volume,
  onToggle,
  onVolume,
}: {
  muted: boolean;
  volume: number;
  onToggle: () => void;
  onVolume: (next: number) => void;
}) {
  const { t } = useTranslation("trailerPreview");
  const label = muted ? t("unmute") : t("mute");
  const shown = muted ? 0 : Math.round(volume * 100);
  return (
    <div className="card-preview-sound" onClick={(e) => e.stopPropagation()} onPointerDown={(e) => e.stopPropagation()}>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={shown}
        aria-label={t("volume")}
        aria-valuetext={`${shown} %`}
        onChange={(e) => onVolume(Number(e.currentTarget.value) / 100)}
        className="card-preview-volume"
        style={{ "--pv-volume": `${shown}%` } as CSSProperties}
      />
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
    </div>
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
