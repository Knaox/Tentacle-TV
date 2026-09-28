import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import type { RecoReason } from "@tentacle-tv/api-client";
import { reasonTexts } from "./recoReasons";

/**
 * `RecoReasonList` de l'app : « Pourquoi ce titre », trois phrases au plus —
 * sous le bandeau de la feuille d'appui long d'une recommandation.
 */
export function RecoReasonList({ reasons, max = 3 }: { reasons: readonly RecoReason[]; max?: number }) {
  const { t } = useTranslation("reco");
  const texts = reasonTexts(reasons, t, max);
  if (texts.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <p className="mb-0.5 text-[10px] font-bold uppercase tracking-[0.8px] text-content-tertiary">{t("whyTitle")}</p>
      {texts.map((text) => (
        <div key={text} className="flex items-start gap-2">
          <Sparkles size={13} strokeWidth={2} className="mt-[3px] shrink-0 text-brand-light" aria-hidden />
          <p className="flex-1 text-[13px] font-medium text-content-secondary">{text}</p>
        </div>
      ))}
    </div>
  );
}
