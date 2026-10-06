import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  channelsLabel,
  codecLabel,
  explainPlayback,
  humanizeReason,
  joinParts,
  rangeLabel,
  reasonKey,
  resolutionLabel,
  type AdminSessionDto,
  type DeliveryKind,
} from "@tentacle-tv/shared";
import { DeliveryChip } from "./DeliveryChip";

/**
 * Comment le média arrive à l'appareil, dit en clair — la règle est partagée
 * (`explainPlayback`), le bureau et le mobile ne font que l'afficher :
 *
 * - la sorte (pastille) et ce qu'elle veut dire (« conteneur seulement, sans
 *   perte »), l'encodeur quand l'image est réencodée ;
 * - POURQUOI : chaque raison de Jellyfin en mots d'administrateur, toujours
 *   visible — c'était un dépliant, et la question qu'on se pose d'abord ;
 * - ce qui change (« HEVC → H.264 · 4K → 1080p ») ;
 * - la source.
 */

const SHORT: Record<DeliveryKind, string> = {
  direct: "directPlayShort",
  remux: "remuxShort",
  audio: "audioTranscodeShort",
  video: "transcodeShort",
  pending: "pendingShort",
};

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(4.5rem,auto)_1fr] gap-x-3">
      <dt className="text-content-tertiary">{label}</dt>
      <dd className="min-w-0 break-words text-content-secondary">{children}</dd>
    </div>
  );
}

export function PlaybackDetails({ session }: { session: AdminSessionDto }) {
  const { t, i18n } = useTranslation("sessions");
  const { kind, reasons, changes, encoder } = explainPlayback(session, i18n.language);
  const { source } = session;
  const completion = session.transcoding?.completionPercentage;

  const sourceLine = source
    ? joinParts([
        joinParts([codecLabel(source.videoCodec), resolutionLabel(source.width, source.height), rangeLabel(source.videoRange)]),
        joinParts([codecLabel(source.audioCodec), channelsLabel(source.audioChannels), source.audioLanguage?.toUpperCase()]),
        source.subtitle,
      ])
    : "";

  const what = joinParts([
    t(SHORT[kind]),
    encoder === null ? null : encoder === "software" ? t("software") : t("encoderHardware", { name: encoder }),
    completion !== undefined && kind !== "direct" ? t("completion", { percent: Math.round(completion) }) : null,
  ]);
  const reasonTexts = reasons.map((line) =>
    t(reasonKey(line), { ...line.params, defaultValue: humanizeReason(line.reason) }),
  );

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <DeliveryChip kind={kind} />
        <span className="text-xs text-content-tertiary">{what}</span>
      </div>
      <dl className="space-y-1">
        {kind !== "direct" && (
          <Row label={t("why")}>
            {reasonTexts.length === 0 ? (
              <span className="text-content-tertiary">{t("whyUnknown")}</span>
            ) : reasonTexts.length === 1 ? (
              reasonTexts[0]
            ) : (
              <ul className="list-disc space-y-0.5 pl-4">
                {reasonTexts.map((text, i) => <li key={reasons[i].reason}>{text}</li>)}
              </ul>
            )}
          </Row>
        )}
        {changes.length > 0 && <Row label={t("changes")}>{changes.join(" · ")}</Row>}
        {sourceLine && <Row label={t("source")}>{sourceLine}</Row>}
      </dl>
    </div>
  );
}
