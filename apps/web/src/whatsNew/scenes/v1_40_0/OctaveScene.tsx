import { useTranslation } from "react-i18next";
import { Music, Pause, SkipBack, SkipForward } from "lucide-react";
import type { SceneProps } from "../../types";
import { CARD_TONES, FauxCursor, Place, SceneStage, instant, sceneTween, useSceneClock } from "..";
import { OctaveLogo } from "../../../music/octave/components/OctaveLogo";
import { FAUX_ALBUMS, FAUX_ARTIST, FauxCover, OCTAVE_INK, SceneOcean, SceneSwell } from "./octaveSceneParts";

/** Tentacle et la bascule, l'appui, Octave s'ouvre, un titre lancé (la houle), l'« en cours » et sa mer. */
const STEPS = [1100, 700, 1400, 1700, 3400] as const;
const PILL = { x: 462, y: 14, w: 160, h: 32 };
const ROW_Y = 252;
const ROW_H = 30;
const TRACKS = [{ n: 1, title: "Nocturne", time: "3:12" }, { n: 2, title: "Lagune", time: "2:58" }, { n: 3, title: "Corail", time: "4:05" }] as const;
const CURSOR = [
  { x: 400, y: 170 },
  { x: PILL.x + 40, y: PILL.y + 18 },
  { x: 380, y: 200 },
  { x: 330, y: ROW_Y + ROW_H + 15 },
  { x: 330, y: ROW_Y + ROW_H + 15 },
] as const;
/** Le dégradé du mot « Octave » et du bouton Lecture (violet → rose, le rose en tête). */
const GRADIENT = "linear-gradient(90deg, rgb(var(--brand-rgb)) 0%, rgb(var(--brand-accent-rgb)) 72%, #F9A8D4 100%)";
const ROSE = "#F472B6";

/** Tentacle, avant : la barre, la bascule « Mode musique », des affiches. */
function TentaclePage({ on }: { on: boolean }) {
  const { t } = useTranslation(["music"]);
  return (
    <>
      {[54, 46, 50].map((w, i) => (
        <Place key={w} x={22 + i * 66} y={25} w={w} h={10} className="rounded-full bg-[rgba(255,255,255,0.12)]" />
      ))}
      <Place x={PILL.x} y={PILL.y} w={PILL.w} h={PILL.h}>
        <span
          className="flex h-full items-center gap-2 rounded-full px-3 text-[12px] font-semibold"
          style={{ background: on ? GRADIENT : "rgba(255,255,255,0.08)", color: on ? "#fff" : "var(--text-secondary)", border: "1px solid rgba(255,255,255,0.12)" }}
        >
          <Music size={14} aria-hidden />
          {t("music:mode.switchLabel")}
        </span>
      </Place>
      {CARD_TONES.slice(0, 5).map((tone, i) => (
        <Place key={i} x={22 + i * 122} y={74} w={108} h={160} className="rounded-[10px]" style={{ background: tone }} />
      ))}
    </>
  );
}

/** Octave : la barre latérale, « Écoutés récemment », trois pochettes, une liste de titres. */
function OctaveHome({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  const { t } = useTranslation(["music"]);
  return (
    <>
      <Place x={0} y={0} w={150} h={360} style={{ background: "rgba(255,255,255,0.025)" }}>
        <span className="absolute left-4 top-4 flex items-center gap-2">
          <OctaveLogo size={24} />
          <span className="text-[15px] font-extrabold" style={{ backgroundImage: GRADIENT, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>Octave</span>
        </span>
        {[t("music:nav.home"), t("music:nav.search"), t("music:nav.library")].map((label, i) => (
          <span key={label} className="absolute left-3 flex h-[26px] w-[124px] items-center rounded-full px-3 text-[11px] font-semibold"
            style={{ top: 60 + i * 32, color: i === 0 ? ROSE : "rgba(255,255,255,0.62)", background: i === 0 ? "rgba(236,72,153,0.16)" : "transparent" }}>
            {label}
          </span>
        ))}
      </Place>
      <Place x={170} y={18}>
        <span className="text-[15px] font-bold text-white">{t("music:home.recentlyPlayed")}</span>
      </Place>
      {FAUX_ALBUMS.map((album, i) => (
        <Place key={album.title} x={170 + i * 140} y={46}>
          <FauxCover album={album} size={120} />
          <p className="mt-1.5 text-[11px] font-semibold text-white">{album.title}</p>
          <p className="text-[10px]" style={{ color: "rgba(255,255,255,0.55)" }}>{FAUX_ARTIST}</p>
        </Place>
      ))}
      {TRACKS.map((track, i) => {
        const current = playing && i === 1;
        return (
          <Place key={track.n} x={170} y={ROW_Y + i * ROW_H} w={450} h={ROW_H - 2} className="rounded-lg"
            style={{ background: current ? "rgba(236,72,153,0.12)" : "transparent" }} transition={reduced ? instant : sceneTween}>
            <span className="flex h-full items-center gap-3 px-2 text-[11px]">
              <span className="flex w-4 justify-center tabular-nums" style={{ color: current ? ROSE : "rgba(255,255,255,0.5)" }}>
                {current ? <SceneSwell size={14} /> : track.n}
              </span>
              <span className="flex-1 font-semibold" style={{ color: current ? ROSE : "#fff" }}>{track.title}</span>
              <span className="tabular-nums" style={{ color: "rgba(255,255,255,0.5)" }}>{track.time}</span>
            </span>
          </Place>
        );
      })}
    </>
  );
}

/** L'« en cours » plein écran : la grande pochette, le titre, la progression, le transport, la mer. */
function NowPlaying({ step, reduced }: { step: number; reduced: boolean }) {
  const { t } = useTranslation(["music"]);
  const album = FAUX_ALBUMS[1];
  return (
    <>
      <div className="absolute inset-0" style={{ background: "radial-gradient(70% 90% at 22% 30%, rgba(31,122,140,0.35), transparent 70%)" }} />
      <SceneOcean height={96} />
      <Place x={64} y={70}>
        <FauxCover album={album} size={190} radius={14} />
      </Place>
      <Place x={290} y={92} w={300}>
        <p className="text-[10px] font-bold tracking-[0.18em]" style={{ color: ROSE }}>{t("music:shell.nowPlaying").toUpperCase()}</p>
        <p className="mt-1 text-[30px] font-extrabold leading-tight text-white">{album.title}</p>
        <p className="text-[13px]" style={{ color: "rgba(255,255,255,0.7)" }}>{FAUX_ARTIST}</p>
        <div className="relative mt-5 h-[4px] w-[280px] overflow-hidden rounded-full bg-[rgba(255,255,255,0.14)]">
          <Place x={0} y={0} w={280} h={4} className="origin-left rounded-full" style={{ background: GRADIENT }}
            scale={1} dx={-280 + 280 * (step >= 4 ? 0.38 : 0.3)} transition={reduced ? instant : { duration: 3, ease: "linear" }} />
        </div>
        <div className="mt-4 flex w-[280px] items-center justify-center gap-6 text-white">
          <SkipBack size={16} fill="currentColor" aria-hidden />
          <span className="flex h-10 w-10 items-center justify-center rounded-full" style={{ backgroundImage: "var(--cta-brand-gradient)" }}>
            <Pause size={16} fill="currentColor" strokeWidth={0} aria-hidden />
          </span>
          <SkipForward size={16} fill="currentColor" aria-hidden />
        </div>
      </Place>
    </>
  );
}

/**
 * Octave, le mode musique : la bascule « Mode musique » de la barre ouvre Octave
 * (son encre prune, son rose), ses pochettes ; un titre lancé roule sa houle,
 * puis l'« en cours » plein écran et sa mer. Pochettes et noms inventés.
 */
export function OctaveScene({ active, reduced }: SceneProps) {
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const cursor = CURSOR[step];
  const octave = step >= 2;
  const playing = step >= 3;
  const nowPlaying = step >= 4;
  return (
    <SceneStage cycle={cycle}>
      <div className="wn-oc absolute inset-0" data-run={active && !reduced ? "1" : "0"} data-reduced={reduced ? "1" : "0"}>
        <TentaclePage on={step >= 1} />
        {/* Octave et son « en cours » se montent un pas avant d'apparaître : rien de caché ne coûte. */}
        {step >= 1 && (
          <Place x={0} y={0} w={640} h={360} visible={octave} style={{ background: OCTAVE_INK }} transition={reduced ? instant : sceneTween}>
            <div className="absolute inset-0" style={{ background: "radial-gradient(60% 70% at 0% 0%, rgba(236,72,153,0.22), transparent 70%)" }} />
            <OctaveHome playing={playing} reduced={reduced} />
          </Place>
        )}
        {step >= 3 && (
          <Place x={0} y={0} w={640} h={360} visible={nowPlaying} dy={nowPlaying ? 0 : 40} style={{ background: OCTAVE_INK }} transition={reduced ? instant : sceneTween}>
            <NowPlaying step={step} reduced={reduced} />
          </Place>
        )}
        <FauxCursor x={cursor.x} y={cursor.y} pressed={step === 1 || step === 3} hidden={nowPlaying} reduced={reduced} />
      </div>
    </SceneStage>
  );
}
