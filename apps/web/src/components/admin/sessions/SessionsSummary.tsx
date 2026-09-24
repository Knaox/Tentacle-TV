import { memo } from "react";
import { useTranslation } from "react-i18next";
import { countDeliveries, DELIVERY_ORDER, type AdminSessionDto } from "@tentacle-tv/shared";
import { DeliveryChip } from "./DeliveryChip";

/**
 * L'en-tête chiffré du tableau de bord : combien de lectures, et ce qu'elles
 * coûtent au serveur — une pastille par sorte présente, de la plus légère à
 * la plus lourde. Elle sert aussi de légende aux pastilles des cartes.
 */
export const SessionsSummary = memo(function SessionsSummary({ sessions }: { sessions: readonly AdminSessionDto[] }) {
  const { t } = useTranslation("sessions");
  const counts = countDeliveries(sessions);
  const playing = DELIVERY_ORDER.reduce((sum, kind) => sum + counts[kind], 0);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium tabular-nums text-content-secondary">{t("playingCount", { count: playing })}</span>
      {playing > 0 && <span aria-hidden className="mx-1 h-4 w-px bg-line-subtle" />}
      {DELIVERY_ORDER.filter((kind) => counts[kind] > 0).map((kind) => (
        <DeliveryChip key={kind} kind={kind} count={counts[kind]} size="sm" />
      ))}
    </div>
  );
});
