import { useTranslation } from "react-i18next";
import { reasonToText, type RecoReason } from "@tentacle-tv/api-client";

/** La première raison qui fait une phrase, ou rien (la phrase vient d'api-client). */
export function RecoReasonText({ reasons }: { reasons: RecoReason[] }) {
  const { t } = useTranslation("reco");
  for (const reason of reasons) {
    const text = reasonToText(reason, t);
    if (text) {
      return <span className="line-clamp-2 text-xs text-content-secondary">{text}</span>;
    }
  }
  return null;
}
