import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";

interface Track {
  index: number;
  label: string;
}

interface TrackSelectorProps {
  audioTracks: Track[];
  subtitleTracks: Track[];
  currentAudio: number;
  currentSubtitle: number | null;
  currentQuality: number | null;
  onAudioChange: (index: number) => void;
  onSubtitleChange: (index: number | null) => void;
  onQualityChange: (bitrate: number | null) => void;
  onClose: () => void;
}

const QUALITIES = [
  { key: "player:original", bitrate: null },
  { key: "player:quality1080p", bitrate: 20_000_000 },
  { key: "player:quality720p", bitrate: 8_000_000 },
  { key: "player:quality480p", bitrate: 4_000_000 },
] as const;

export function TrackSelector({
  audioTracks, subtitleTracks,
  currentAudio, currentSubtitle, currentQuality,
  onAudioChange, onSubtitleChange, onQualityChange, onClose,
}: TrackSelectorProps) {
  const { t } = useTranslation("player");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 w-80 rounded-xl border border-white/10 bg-black/90 p-4 backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">{t("player:settings")}</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">&times;</button>
      </div>

      <div className="max-h-[60vh] overflow-y-auto scrollbar-thin">
        {audioTracks.length > 0 && (
          <Section title={t("player:audio")}>
            {audioTracks.map((t) => (
              <TrackOption
                key={t.index}
                label={t.label}
                active={currentAudio === t.index}
                onClick={() => onAudioChange(t.index)}
              />
            ))}
          </Section>
        )}

        {subtitleTracks.length > 0 && (
          <Section title={t("player:subtitles")}>
            <TrackOption label={t("player:subtitlesDisabled")} active={currentSubtitle === null} onClick={() => onSubtitleChange(null)} />
            {subtitleTracks.map((t) => (
              <TrackOption
                key={t.index}
                label={t.label}
                active={currentSubtitle === t.index}
                onClick={() => onSubtitleChange(t.index)}
              />
            ))}
          </Section>
        )}

        <Section title={t("player:quality")}>
          {QUALITIES.map((q) => (
            <TrackOption
              key={q.key}
              label={t(q.key)}
              active={currentQuality === q.bitrate}
              onClick={() => onQualityChange(q.bitrate)}
            />
          ))}
        </Section>
      </div>
    </motion.div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-3 last:mb-0">
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-white/40">{title}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function TrackOption({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  const { lang, codec, title } = parseTrackLabel(label);

  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-tentacle-accent/20 text-tentacle-accent-light" : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${active ? "bg-tentacle-accent" : "bg-transparent"}`} />
      <span className="flex flex-1 items-center gap-1.5 overflow-hidden">
        <span className="truncate">{title}</span>
        {lang && <Badge color="purple">{lang}</Badge>}
        {codec && <Badge color="zinc">{codec}</Badge>}
      </span>
    </button>
  );
}

function Badge({ color, children }: { color: "purple" | "zinc"; children: React.ReactNode }) {
  const cls = color === "purple"
    ? "bg-purple-500/20 text-purple-300"
    : "bg-white/10 text-white/50";
  return <span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

/** Extract language, codec, and title from track label like "French - AAC" */
function parseTrackLabel(raw: string) {
  const parts = raw.split(" - ");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1].trim();
    const isCodec = /^[A-Z0-9]{2,8}$/i.test(last);
    return {
      title: parts.slice(0, isCodec ? -1 : undefined).join(" - "),
      codec: isCodec ? last : null,
      lang: extractLang(parts[0]),
    };
  }
  return { title: raw, codec: null, lang: extractLang(raw) };
}

const LANG_MAP: Record<string, string> = {
  french: "FR", français: "FR", francais: "FR", fre: "FR", fra: "FR",
  english: "EN", anglais: "EN", eng: "EN",
  japanese: "JP", japonais: "JP", jpn: "JP",
  german: "DE", allemand: "DE", ger: "DE", deu: "DE",
  spanish: "ES", espagnol: "ES", spa: "ES",
  undetermined: "", und: "",
};

function extractLang(text: string): string | null {
  const lower = text.toLowerCase().trim();
  for (const [key, code] of Object.entries(LANG_MAP)) {
    if (lower.includes(key)) return code || null;
  }
  return null;
}
