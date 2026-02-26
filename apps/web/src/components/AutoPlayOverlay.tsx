import { useTranslation } from "react-i18next";

interface AutoPlayOverlayProps {
  countdown: number;
  episodeTitle?: string;
  onPlay: () => void;
  onCancel: () => void;
}

export function AutoPlayOverlay({ countdown, episodeTitle, onPlay, onCancel }: AutoPlayOverlayProps) {
  const { t } = useTranslation("player");
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/80" onClick={(e) => e.stopPropagation()}>
      <div className="flex flex-col items-center gap-6 text-center">
        <p className="text-lg text-white/70">{t("player:nextEpisodeIn")}</p>
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-tentacle-accent">
          <span className="text-4xl font-bold text-white">{countdown}</span>
        </div>
        {episodeTitle && <p className="text-sm text-white/50">{episodeTitle}</p>}
        <div className="flex gap-4">
          <button onClick={onPlay} className="rounded-lg bg-tentacle-accent px-6 py-2.5 text-sm font-semibold text-white hover:bg-tentacle-accent/80">
            {t("player:playNow")}
          </button>
          <button onClick={onCancel} className="rounded-lg bg-white/10 px-6 py-2.5 text-sm text-white/70 hover:bg-white/20">
            {t("common:cancel")}
          </button>
        </div>
      </div>
    </div>
  );
}
