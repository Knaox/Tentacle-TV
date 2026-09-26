import { useTranslation } from "react-i18next";
import { EyeOff, Sparkles } from "lucide-react";
import { useSendRecoFeedback, type RecoReason, type RecoRowItem } from "@tentacle-tv/api-client";
import { BottomSheet } from "../../ui/BottomSheet";
import { reasonTexts } from "./recoReasons";

/**
 * `RecoActionSheet` de l'app : l'appui long sur une recommandation HORS
 * bibliothèque — titre 18 gras, année, « Pourquoi ce titre », et « Ne plus me
 * proposer » (retrait optimiste de toutes les pages en cache). Feuille à
 * paliers 45 / 80 %. Un titre en bibliothèque passe par `MediaActionSheet`.
 */
export function RecoActionSheet({ item, onClose }: { item: RecoRowItem | null; onClose: () => void }) {
  const { t } = useTranslation("reco");
  const feedback = useSendRecoFeedback();
  const dismissItem = () => {
    if (item) feedback.mutate({ itemKey: item.key, action: "dismissed" });
    onClose();
  };

  return (
    <BottomSheet open={item !== null} onClose={onClose} snapPoints={[0.45, 0.8]} label={item?.title}>
      {item && (
        <div className="flex flex-col gap-2 px-4 pb-5">
          <p className="line-clamp-2 text-lg font-bold tracking-[-0.4px] text-content-primary">{item.title}</p>
          {item.year != null && <p className="text-[13px] text-content-tertiary">{item.year}</p>}
          <div className="mt-2">
            <RecoReasonList reasons={item.reasons} />
          </div>
          <button
            type="button"
            onClick={dismissItem}
            className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-3 text-left text-[15px] font-semibold text-content-primary active:opacity-80"
          >
            <EyeOff size={18} aria-hidden />
            {t("dismissAction")}
          </button>
        </div>
      )}
    </BottomSheet>
  );
}

/** `RecoReasonList` de l'app : « Pourquoi ce titre », trois phrases au plus. */
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
