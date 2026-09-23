import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import type { AdminSessionDto } from "@tentacle-tv/shared";
import { DeliveryChip } from "./DeliveryChip";
import { deliveryOf, type DeliveryKind } from "./delivery";
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
 * Comment le média arrive à l'appareil : lecture directe, remux, transcodage
 * audio ou transcodage — la source, ce qui est envoyé, et pourquoi le serveur
 * travaille. La sorte se lit dans le libellé et l'icône, pas dans la seule
 * couleur (`DeliveryChip`).
 */

const REASONS_KEY: Record<Exclude<DeliveryKind, "direct">, string> = {
  remux: "reasonsRemux",
  audio: "reasonsAudio",
  video: "reasons",
};

export function PlaybackDetails({ session }: { session: AdminSessionDto }) {
  const { t, i18n } = useTranslation("sessions");
  const [showReasons, setShowReasons] = useState(false);
  const reasonsId = useId();
  const { source, transcoding } = session;
  const kind = deliveryOf(session);
  const locale = i18n.language;

  const sourceLine = source
    ? joinParts([
        joinParts([codecLabel(source.videoCodec), resolutionLabel(source.width, source.height), rangeLabel(source.videoRange)]),
        joinParts([codecLabel(source.audioCodec), channelsLabel(source.audioChannels), source.audioLanguage?.toUpperCase()]),
        source.subtitle,
      ])
    : "";

  // Un remux ne change QUE le conteneur : c'est lui qu'on nomme.
  const outputLine = transcoding
    ? kind === "remux"
      ? joinParts([t("streamsCopied"), transcoding.container ? t("container", { name: transcoding.container.toUpperCase() }) : null])
      : joinParts([
          transcoding.isVideoDirect
            ? kind === "audio" ? t("videoDirect") : null
            : joinParts([codecLabel(transcoding.videoCodec), resolutionLabel(transcoding.width, transcoding.height)]),
          transcoding.isAudioDirect
            ? t("audioDirect")
            : joinParts([codecLabel(transcoding.audioCodec), channelsLabel(transcoding.audioChannels)]),
          formatBitrate(transcoding.bitrate, locale),
          kind === "video" ? acceleratorLabel(transcoding.hardwareAccelerationType) ?? t("software") : null,
        ])
    : "";

  const reasons = transcoding?.reasons ?? [];
  const completion = transcoding?.completionPercentage;

  return (
    <div className="space-y-2 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <DeliveryChip kind={kind} />
        {completion !== undefined && kind !== "direct" && (
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
      {reasons.length > 0 && kind !== "direct" && (
        <div>
          <button
            type="button"
            aria-expanded={showReasons}
            aria-controls={reasonsId}
            onClick={() => setShowReasons((open) => !open)}
            className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-md px-1 text-xs font-medium text-content-tertiary outline-none transition-colors hover:text-content-primary focus-visible:ring-2 focus-visible:ring-line-focus"
          >
            {t(REASONS_KEY[kind])}
            <ChevronDown size={14} aria-hidden className={`transition-transform duration-200 ${showReasons ? "rotate-180" : ""}`} />
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
