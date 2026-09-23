import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, CircleCheck, Cpu, Repeat } from "lucide-react";
import type { AdminSessionDto } from "@tentacle-tv/shared";
import { cls } from "../../../pages/adminUtils";
import {
  acceleratorLabel,
  channelsLabel,
  codecLabel,
  formatBitrate,
  humanizeReason,
  joinParts,
  rangeLabel,
  resolutionLabel,
} from "./format";

/**
 * Comment le média arrive à l'appareil : lecture directe, remux ou
 * transcodage — la source, ce qui est envoyé, et pourquoi le serveur
 * travaille. L'état se lit dans le libellé et l'icône, pas dans la seule
 * couleur.
 */

const METHOD_STYLE = {
  DirectPlay: { key: "directPlay", hint: "directPlayHint", tone: "bg-status-success-bg text-status-success-fg", Icon: CircleCheck },
  DirectStream: { key: "directStream", hint: "directStreamHint", tone: "bg-status-info-bg text-status-info-fg", Icon: Repeat },
  Transcode: { key: "transcode", hint: "transcodeHint", tone: "bg-status-warning-bg text-status-warning-fg", Icon: Cpu },
} as const;

export function PlaybackDetails({ session }: { session: AdminSessionDto }) {
  const { t, i18n } = useTranslation("sessions");
  const [showReasons, setShowReasons] = useState(false);
  const reasonsId = useId();
  const { source, transcoding } = session;
  const method = METHOD_STYLE[session.playMethod ?? "DirectPlay"];
  const locale = i18n.language;

  const sourceLine = source
    ? joinParts([
        joinParts([codecLabel(source.videoCodec), resolutionLabel(source.width, source.height), rangeLabel(source.videoRange)]),
        joinParts([codecLabel(source.audioCodec), channelsLabel(source.audioChannels), source.audioLanguage?.toUpperCase()]),
        source.subtitle,
      ])
    : "";

  const outputLine = transcoding
    ? joinParts([
        transcoding.isVideoDirect
          ? t("videoDirect")
          : joinParts([codecLabel(transcoding.videoCodec), resolutionLabel(transcoding.width, transcoding.height)]),
        transcoding.isAudioDirect
          ? t("audioDirect")
          : joinParts([codecLabel(transcoding.audioCodec), channelsLabel(transcoding.audioChannels)]),
        formatBitrate(transcoding.bitrate, locale),
        transcoding.isVideoDirect ? null : acceleratorLabel(transcoding.hardwareAccelerationType) ?? t("software"),
      ])
    : "";

  const reasons = transcoding?.reasons ?? [];
  const completion = transcoding?.completionPercentage;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`${cls.chip} ${method.tone}`} title={t(method.hint)}>
          <method.Icon size={13} aria-hidden />
          {t(method.key)}
        </span>
        {completion !== undefined && session.playMethod === "Transcode" && (
          <span className="text-xs tabular-nums text-content-tertiary">
            {t("completion", { percent: Math.round(completion) })}
          </span>
        )}
      </div>
      {sourceLine && (
        <p className="break-words text-content-secondary">
          <span className="text-content-tertiary">{t("source")} · </span>
          {sourceLine}
        </p>
      )}
      {outputLine && (
        <p className="break-words text-content-secondary">
          <span className="text-content-tertiary">{t("output")} · </span>
          {outputLine}
        </p>
      )}
      {reasons.length > 0 && (
        <div>
          <button
            type="button"
            aria-expanded={showReasons}
            aria-controls={reasonsId}
            onClick={() => setShowReasons((open) => !open)}
            className="inline-flex min-h-11 cursor-pointer items-center gap-1 text-xs font-medium text-content-tertiary hover:text-content-primary"
          >
            {t("reasons")}
            <ChevronDown size={14} aria-hidden className={showReasons ? "rotate-180" : undefined} />
          </button>
          {showReasons && (
            <ul id={reasonsId} className="list-disc space-y-0.5 pl-5 text-xs text-content-secondary">
              {reasons.map((reason) => (
                <li key={reason}>{t(`reason.${reason}`, { defaultValue: humanizeReason(reason) })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
