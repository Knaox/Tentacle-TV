import { useTranslation } from "react-i18next";
import { Sparkles } from "lucide-react";
import { recoPosterUrl, useJellyfinClient, useSendRecoFeedback, type RecoReason, type RecoRowItem } from "@tentacle-tv/api-client";
import { ExternalActionSheet } from "../../cards/ExternalActionSheet";
import { reasonTexts } from "./recoReasons";

/**
 * `RecoActionSheet` de l'app : l'appui long sur une recommandation HORS
 * bibliothèque. C'est la feuille de TOUTES les cartes Vigie
 * (`ExternalActionSheet`) — « Demander », la note, Ma liste à l'arrivée —
 * avec ce qu'une recommandation ajoute : « Pourquoi ce titre », et « Ne plus
 * me proposer » (retrait optimiste de toutes les pages en cache). Un titre en
 * bibliothèque passe par `MediaActionSheet`.
 */
export function RecoActionSheet({ item, onClose }: { item: RecoRowItem | null; onClose: () => void }) {
  const client = useJellyfinClient();
  const feedback = useSendRecoFeedback();
  const target = item && {
    title: { mediaType: item.mediaType, tmdbId: item.tmdbId },
    name: item.title,
    year: item.year,
    imageUrl: recoPosterUrl(item, (id) => client.getImageUrl(id, "Primary", { width: 240, quality: 85 })),
  };

  return (
    <ExternalActionSheet
      target={target}
      variant="reco"
      onClose={onClose}
      extra={item ? <RecoReasonList reasons={item.reasons} /> : undefined}
      onDismiss={item ? () => feedback.mutate({ itemKey: item.key, action: "dismissed" }) : undefined}
    />
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
