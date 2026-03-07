import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { MediaStream } from "@tentacle-tv/shared";

interface TechInfoProps {
  streams: MediaStream[];
}

export function TechInfo({ streams }: TechInfoProps) {
  const { t } = useTranslation("media");
  const [open, setOpen] = useState(false);

  const video = streams.find((s) => s.Type === "Video");
  const audioTracks = streams.filter((s) => s.Type === "Audio");
  const subtitleCount = streams.filter((s) => s.Type === "Subtitle").length;

  if (!video && audioTracks.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-2 text-sm text-white/50 transition-colors hover:text-white/70"
      >
        <ChevronIcon open={open} />
        {t("media:techInfo")}
      </button>
      {open && (
        <div className="mt-2 space-y-1.5 rounded-lg bg-white/5 p-3 text-xs text-white/60">
          {video && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-white/70">{t("media:video")}:</span>
              <span>{video.Codec?.toUpperCase()} {video.Width}×{video.Height}</span>
              {video.VideoRangeType && video.VideoRangeType !== "SDR" && (
                <span className="rounded border border-white/20 px-1.5 py-0.5">{video.VideoRangeType}</span>
              )}
            </div>
          )}
          {audioTracks.map((a, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-medium text-white/70">{t("media:audioTrack")} {i + 1}:</span>
              <span>{a.DisplayTitle || a.Codec?.toUpperCase()}</span>
              {a.Language && <span className="uppercase text-white/40">{a.Language}</span>}
              {a.Channels != null && <span>{a.Channels >= 8 ? "7.1" : a.Channels >= 6 ? "5.1" : `${a.Channels}.0`}</span>}
            </div>
          ))}
          {subtitleCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="font-medium text-white/70">{t("media:subtitleTracks")}:</span>
              <span>{subtitleCount} {subtitleCount > 1 ? "tracks" : "track"}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg className={`h-4 w-4 transition-transform duration-200 ${open ? "rotate-90" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}
