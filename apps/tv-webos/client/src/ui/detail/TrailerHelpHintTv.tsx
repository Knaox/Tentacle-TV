import { memo } from "react";
import { useTranslation } from "react-i18next";
import { useFicheTrailerHint } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";

/**
 * Le rappel « Vous ne voyez pas les bandes-annonces ? » au téléviseur : une
 * PHRASE, sans lien ni croix. Un guide ne se lit pas à la télécommande, et
 * rien de focalisable ne s'ajoute à la zone d'actions (dont l'entrée est le
 * premier bouton du bloc) : la phrase renvoie vers l'app web ou mobile, où
 * le guide vit — et où l'on masque le rappel, pour tous les appareils du
 * compte.
 *
 * Même règle que partout (`useFicheTrailerHint`, phase `hint`). Rendue en
 * bout de la rangée d'actions comme sur le web, mais sur SA ligne
 * (`basis-full`) : une phrase entre deux boutons ne se lit pas au salon.
 *
 * Substitué à `apps/web/src/components/detail/TrailerHelpHint.tsx`.
 */
export const TrailerHelpHint = memo(function TrailerHelpHint({ item }: { item: MediaItem }) {
  const { t, i18n } = useTranslation("trailerHelp");
  const { phase } = useFicheTrailerHint(item, i18n.language);
  if (phase !== "hint") return null;

  return (
    <p className="pointer-events-none basis-full max-w-3xl text-base leading-snug text-on-media-secondary">
      {t("hintTv")}
    </p>
  );
});
