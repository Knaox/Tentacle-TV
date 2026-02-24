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
  { label: "Original", bitrate: null },
  { label: "1080p", bitrate: 20_000_000 },
  { label: "720p", bitrate: 8_000_000 },
  { label: "480p", bitrate: 4_000_000 },
] as const;

export function TrackSelector({
  audioTracks, subtitleTracks,
  currentAudio, currentSubtitle, currentQuality,
  onAudioChange, onSubtitleChange, onQualityChange, onClose,
}: TrackSelectorProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 10 }}
      className="absolute bottom-20 right-6 z-50 w-72 rounded-xl border border-white/10 bg-black/90 p-4 backdrop-blur-xl"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-white">Paramètres</span>
        <button onClick={onClose} className="text-white/40 hover:text-white">&times;</button>
      </div>

      {/* Audio tracks */}
      {audioTracks.length > 0 && (
        <Section title="Audio">
          {audioTracks.map((t) => (
            <Option
              key={t.index}
              label={t.label}
              active={currentAudio === t.index}
              onClick={() => onAudioChange(t.index)}
            />
          ))}
        </Section>
      )}

      {/* Subtitle tracks */}
      {subtitleTracks.length > 0 && (
        <Section title="Sous-titres">
          <Option label="Désactivés" active={currentSubtitle === null} onClick={() => onSubtitleChange(null)} />
          {subtitleTracks.map((t) => (
            <Option
              key={t.index}
              label={t.label}
              active={currentSubtitle === t.index}
              onClick={() => onSubtitleChange(t.index)}
            />
          ))}
        </Section>
      )}

      {/* Quality */}
      <Section title="Qualité">
        {QUALITIES.map((q) => (
          <Option
            key={q.label}
            label={q.label}
            active={currentQuality === q.bitrate}
            onClick={() => onQualityChange(q.bitrate)}
          />
        ))}
      </Section>
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

function Option({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-tentacle-accent/20 text-tentacle-accent-light" : "text-white/70 hover:bg-white/5 hover:text-white"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-tentacle-accent" : "bg-transparent"}`} />
      {label}
    </button>
  );
}
