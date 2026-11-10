import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { CaretRightIcon } from "@phosphor-icons/react/dist/csr/CaretRight";
import type { MediaStream } from "@tentacle-tv/shared";

const ROW = "flex flex-wrap items-center gap-x-3 gap-y-1";
const TERM = "w-28 flex-shrink-0 font-semibold text-content-secondary";

interface TechInfoProps {
  streams: MediaStream[];
}

/**
 * « Infos techniques » : repliées par défaut — presque personne ne les ouvre —,
 * derrière une pilule discrète ; ouvertes, un panneau du socle (une teinte, pas
 * un liseré) : la vidéo, chaque piste audio, le nombre de sous-titres.
 */
export function TechInfo({ streams }: TechInfoProps) {
  const { t } = useTranslation("media");
  const [open, setOpen] = useState(false);
  const panelId = useId();

  const video = streams.find((s) => s.Type === "Video");
  const audioTracks = streams.filter((s) => s.Type === "Audio");
  const subtitleCount = streams.filter((s) => s.Type === "Subtitle").length;

  if (!video && audioTracks.length === 0) return null;

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        aria-expanded={open}
        aria-controls={panelId}
        className="btn btn-ghost btn-sm -ml-3"
      >
        <CaretRightIcon weight="bold" aria-hidden className={`h-3.5 w-3.5 transition-transform duration-hover ease-out ${open ? "rotate-90" : ""}`} />
        {t("media:techInfo")}
      </button>
      {open && (
        // Une ligne par piste (`dl > div > dt + dd`) : en flex, le client LG (Chrome 53) n'a pas `display: contents`.
        <dl id={panelId} className="ui-panel mt-2 max-w-3xl space-y-2 p-4 text-xs text-content-tertiary">
          {video && (
            <div className={ROW}>
              <dt className={TERM}>{t("media:video")}</dt>
              <dd className="flex flex-wrap items-center gap-2 tabular-nums">
                <span>{video.Codec?.toUpperCase()} {video.Width}×{video.Height}</span>
                {video.VideoRangeType && video.VideoRangeType !== "SDR" && <span className="chip">{video.VideoRangeType}</span>}
              </dd>
            </div>
          )}
          {audioTracks.map((a, i) => (
            <div key={i} className={ROW}>
              <dt className={TERM}>{t("media:audioTrack")} {i + 1}</dt>
              <dd className="flex flex-wrap items-center gap-2">
                <span>{a.DisplayTitle || a.Codec?.toUpperCase()}</span>
                {a.Language && <span className="uppercase text-content-quaternary">{a.Language}</span>}
                {a.Channels != null && <span className="tabular-nums">{a.Channels >= 8 ? "7.1" : a.Channels >= 6 ? "5.1" : `${a.Channels}.0`}</span>}
              </dd>
            </div>
          ))}
          {subtitleCount > 0 && (
            <div className={ROW}>
              <dt className={TERM}>{t("media:subtitleTracks")}</dt>
              <dd className="tabular-nums">{subtitleCount}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
