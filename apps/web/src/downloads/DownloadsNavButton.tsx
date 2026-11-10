/**
 * Entrée « Téléchargements » du TopNav (desktop uniquement) — non rendue sans
 * droit ni contenu (invisibilité stricte).
 *
 * Elle lit l'avancement GLOBAL du lot en cours (`useOfflineQueueProgress`, le
 * même que l'écran de la file) et le MONTRE : un anneau au dégradé de jauge
 * autour de l'icône, qui passe en plein tant qu'un lot avance. Le pourcentage
 * reste dit dans son libellé et porté par `data-queue-percent`.
 *
 * L'anneau ne coûte rien au repos : `transform` seulement (`QueueRing`), aucune
 * animation infinie — plus de point qui bat dans une barre affichée partout —,
 * et il est GELÉ tant que le bouton n'est pas visible (fenêtre en arrière-plan,
 * barre sortie de l'écran) : il reprend à la bonne valeur au retour.
 */

import { useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useOfflineQueueProgress } from "@tentacle-tv/offline-core/react";
import { supportsDownloads } from "../desktop/bridge";
import { useInViewport } from "../hooks/useInViewport";
import { DownloadGlyph } from "./DownloadGlyph";
import { QueueRing } from "./ui/QueueRing";
import { useDownloadsList, useDownloadsVisibility } from "./useDownloadState";

export function DownloadsNavButton() {
  const { t } = useTranslation(["nav", "downloads"]);
  const navigate = useNavigate();
  const { visible } = useDownloadsVisibility();
  const entries = useDownloadsList();
  const lot = useOfflineQueueProgress(entries);
  const { ref, visible: onScreen } = useInViewport<HTMLButtonElement>();
  // Hors écran, l'anneau garde la dernière valeur montrée : aucune image n'est
  // produite pour un bouton que personne ne voit.
  const shownRatio = useRef(0);

  if (!supportsDownloads() || !visible) return null;
  const ratio = lot === null ? null : lot.ratio;
  const percent = ratio === null ? null : Math.floor(ratio * 100);
  if (onScreen || lot === null) shownRatio.current = ratio ?? 0;
  const label =
    percent === null ? t("downloads") : t("downloads:overviewNavProgress", { label: t("downloads"), percent });

  return (
    <button
      ref={ref}
      type="button"
      onClick={() => navigate("/downloads")}
      aria-label={label}
      title={label}
      data-queue-percent={percent ?? undefined}
      data-queue-active={lot !== null ? "true" : undefined}
      className="icon-btn relative"
    >
      <DownloadGlyph done={lot !== null} className={lot !== null ? "h-4 w-4" : "h-5 w-5"} />
      {/* Un lot en file : l'anneau, même avant le premier octet mesuré (piste seule). */}
      {lot !== null && <QueueRing ratio={shownRatio.current} />}
    </button>
  );
}
