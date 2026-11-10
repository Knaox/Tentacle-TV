/**
 * Octave — la marque d'un titre qui ne se lit pas (`trackPlayability.ts`, lot « ol ») : l'icône ET le mot (jamais
 * la couleur seule), au ton tertiaire. La raison complète est dans l'infobulle et dans l'avis au clic.
 */

import { memo } from "react";
import { CloudSlashIcon as CloudOff } from "@phosphor-icons/react/dist/csr/CloudSlash";
import { useTranslation } from "react-i18next";
import { unplayableReasonKey, type UnplayableReason } from "@tentacle-tv/shared/octave";

export const UnplayableMark = memo(function UnplayableMark({ reason }: { reason: UnplayableReason | null }) {
  const { t } = useTranslation("music");
  return (
    <span className="inline-flex shrink-0 items-center gap-1 text-content-tertiary" title={t(unplayableReasonKey(reason))} data-unplayable>
      <CloudOff className="h-3.5 w-3.5" aria-hidden />
      <span>{t("unplayableTrack.badge")}</span>
    </span>
  );
});
