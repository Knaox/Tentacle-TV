import { useTranslation } from "react-i18next";
import { recoItemReasonText, recoMatchOf, type RecoPageRow, type RecoRowItem } from "@tentacle-tv/api-client";

interface RecoReasonTextProps {
  item: Pick<RecoRowItem, "why" | "reasons" | "match">;
  /** La rangée qui porte la carte : sa raison n'est pas répétée sous chaque titre. */
  row?: Pick<RecoPageRow, "why" | "seedTitle">;
}

/**
 * La raison d'une carte, DISCRÈTE : une ligne, ton tertiaire — la
 * correspondance d'abord quand le moteur s'y engage (« 92 % · Réalisé par… »).
 * La phrase vient d'api-client (raison structurée, sinon historique) ; rien
 * plutôt qu'une phrase creuse.
 */
export function RecoReasonText({ item, row }: RecoReasonTextProps) {
  const { t, i18n } = useTranslation("reco");
  const text = recoItemReasonText(item, t, { locale: i18n.language, row });
  const match = recoMatchOf(item);
  if (!text && match === null) return null;
  return (
    <span className="line-clamp-2 text-xs text-content-tertiary">
      {match !== null && <span className="font-semibold text-[var(--brand-accent)]">{t("spotlightMatch", { match })}</span>}
      {match !== null && text && " · "}
      {text}
    </span>
  );
}
