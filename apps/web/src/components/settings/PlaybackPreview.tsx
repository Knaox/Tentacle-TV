/**
 * L'aperçu : ce que le réglage va faire, MONTRÉ plutôt qu'expliqué.
 *
 * # Pourquoi il existe
 *
 * Ces réglages décrivaient en trois lignes chacun un objet que l'utilisateur a
 * déjà vu cent fois — la pilule blanche qui propose de passer un générique. La
 * montrer coûte une phrase de moins et lève l'ambiguïté d'un coup : « proposer
 * un bouton » et « passer tout seul » ne se distinguent pas dans un texte, ils
 * se distinguent à l'écran.
 *
 * # C'est le VRAI bouton
 *
 * `SkipSegmentButton` est monté ici tel quel — même pilule, même croix, même
 * balayage de décompte, mêmes libellés que dans le lecteur. Pas un sosie : un
 * sosie dériverait au premier changement, et l'aperçu mentirait sans que rien
 * ne le signale.
 *
 * # Ce que le cadre n'est pas
 *
 * Pas une vidéo, pas une image : un dégradé et deux traits, qui suggèrent une
 * image de film et un habillage de lecteur. Rien à charger, rien à décoder, et
 * la page des réglages ne paie pas une couche composée de plus.
 */

import { useTranslation } from "react-i18next";
import type { SegmentSettings, SkipLabelKey } from "@tentacle-tv/shared";
import { SkipSegmentButton } from "../player/SkipSegmentButton";
import { usePreviewCountdown } from "./usePreviewCountdown";

interface PlaybackPreviewProps {
  /** Le réglage à montrer — celui de la ligne qu'on est en train de toucher. */
  settings: SegmentSettings;
  /** Le libellé du bouton, celui du passage concerné. */
  labelKey: SkipLabelKey;
  /** Le nom du passage, pour dire de QUI l'aperçu parle. */
  passage: string;
}

/** La phrase qui dit ce qui va se passer — et qui reste le seul canal en
 *  l'absence de bouton, ou pour un lecteur d'écran. */
function captionKey(settings: SegmentSettings): string {
  if (settings.action === "off") return "previewCaptionOff";
  if (settings.action === "button") return "previewCaptionButton";
  return settings.countdownVisible ? "previewCaptionAuto" : "previewCaptionAutoSilent";
}

export function PlaybackPreview({ settings, labelKey, passage }: PlaybackPreviewProps) {
  const { t } = useTranslation("preferences");
  const counting = settings.action === "auto" && settings.countdownVisible;
  const { seconds, cycle, ref } = usePreviewCountdown(counting, settings.autoDelayMs);
  const showPill = settings.action !== "off";

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-content-tertiary">
          {t("previewTitle")}
        </p>
        <p className="truncate text-xs text-content-quaternary">{passage}</p>
      </div>

      {/* ⚠️ Le cadre est SOMBRE dans les deux thèmes, et pas en jetons de
          surface : il ne représente pas une surface de l'application mais une
          IMAGE DE FILM. Mesuré en thème clair — un cadre en `tentacle-surface`
          y devient presque blanc, et la pilule, blanche des deux côtés
          (`--cta-primary-bg: #FFFFFF`), s'y efface. L'aperçu montrait alors
          l'inverse de ce qu'il promet. */}
      <div
        ref={ref}
        aria-hidden="true"
        className="relative mt-2 aspect-video w-full max-w-md overflow-hidden rounded-xl border border-line-subtle"
        style={{ background: "linear-gradient(135deg, #2b2436 0%, #16131c 55%, #0a0a0d 100%)" }}
      >
        {/* Le décor : deux traits qui suggèrent une barre de lecture. Ni image
            ni vidéo — l'aperçu ne doit rien télécharger. */}
        <div className="absolute inset-x-6 bottom-4 h-[3px] rounded-full bg-white/15">
          <div className="h-full w-2/3 rounded-full bg-white/50" />
        </div>

        {showPill && (
          <div className="absolute inset-0 origin-bottom-right scale-[0.82]">
            <SkipSegmentButton
              // Le tour de décompte sert de clé : la pilule se remonte, et son
              // balayage rejoue depuis le début.
              key={`${labelKey}-${String(cycle)}`}
              labelKey={labelKey}
              countdownSeconds={counting ? seconds : null}
              countdownTotalMs={settings.autoDelayMs}
              onSkip={() => undefined}
              onDismiss={() => undefined}
              layer="z-10"
            />
          </div>
        )}
      </div>

      <p className="mt-2 max-w-md text-xs leading-relaxed text-content-tertiary">
        {t(captionKey(settings), { seconds: Math.round(settings.autoDelayMs / 100) / 10 })}
      </p>
    </div>
  );
}
