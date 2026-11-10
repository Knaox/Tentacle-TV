import type { StillWatchingController } from "@tentacle-tv/api-client";
import { PlaybackBadge } from "../../components/PlaybackBadge";
import { SkipBadge } from "../../components/SkipBadge";
import { NoticeCard } from "../../components/notices/NoticeCard";
import { NextEpisodeFullscreen } from "../../components/player/NextEpisodeFullscreen";
import { PlaybackSpinner } from "../../components/player/PlaybackSpinner";
import { QualityDropNotice } from "../../components/player/QualityDropNotice";
import { SkipSegmentButton } from "../../components/player/SkipSegmentButton";
import { StillWatchingPrompt } from "../../components/player/StillWatchingPrompt";
import { UpNextCard } from "../../components/player/UpNextCard";
import { labImages, labParam } from "./labFixtures";
import { LabStage } from "./labStage";

const noop = () => {};

/**
 * Ce qui se pose sur l'image HORS de l'habillage : la pilule de saut (intro, résumé, générique),
 * la fiche « à suivre », l'affiche de fin, « Vous regardez encore ? », les badges, l'attente,
 * et les avis (panne de Jellyfin, baisse de qualité). `?etat=` choisit l'encart.
 */
export function LabOverlays() {
  const state = labParam("etat") ?? "saut";
  const images = labImages();
  const stillWatching = (phase: "asking" | "paused"): StillWatchingController => ({
    phase, remainingMs: 18_000, countdownMs: 30_000,
    reportActivity: noop, keepWatching: noop, pauseNow: noop, resume: noop,
  });

  if (state === "fin") {
    return (
      <LabStage>
        <NextEpisodeFullscreen
          countdown={8} totalSeconds={10}
          episodeTitle="Llamigos" episodeLabel="Caminandes · S1 · É3"
          episodeDescription="Koro rencontre Oti, un manchot aussi affamé que lui, et les deux se disputent les dernières baies de l'hiver."
          seriesBackdropUrl={images.backdropNext} episodeThumbUrl={images.thumb}
          onPlayNow={noop} onDismiss={noop}
        />
      </LabStage>
    );
  }

  return (
    <LabStage>
      {state === "saut" && (
        <SkipSegmentButton labelKey="skipIntro" countdownSeconds={null} countdownTotalMs={0} onSkip={noop} onDismiss={noop} layer="z-20" />
      )}
      {state === "saut-decompte" && (
        <SkipSegmentButton labelKey="skipCredits" countdownSeconds={4} countdownTotalMs={5000} onSkip={noop} onDismiss={noop} layer="z-20" />
      )}
      {state === "suivant" && (
        <UpNextCard
          countdown={7} totalSeconds={10}
          episodeTitle="Llamigos" episodeLabel="S1 · É3"
          episodeDescription="Koro rencontre Oti, un manchot aussi affamé que lui."
          episodeImageUrl={images.backdropNext} onPlay={noop} onDismiss={noop}
        />
      )}
      {state === "encore-la" && <StillWatchingPrompt controller={stillWatching("asking")} controlsVisible={false} surface="web" />}
      {state === "en-pause" && <StillWatchingPrompt controller={stillWatching("paused")} controlsVisible={false} surface="web" />}
      {state === "badges" && (
        <>
          <PlaybackBadge flash={{ id: 1, kind: "pause" }} />
          <SkipBadge flash={{ id: 1, delta: 30 }} />
        </>
      )}
      {state === "attente" && <PlaybackSpinner hint="Le serveur prépare ce passage…" />}
      {state === "qualite" && (
        <QualityDropNotice drop={{ cause: "network", measuredBps: 6_200_000, neededBps: 24_000_000 }} started itemId="lab-episode-2" />
      )}
      {state === "panne" && <OutageTwin long={false} />}
      {state === "panne-longue" && <OutageTwin long />}
    </LabStage>
  );
}

/**
 * Le JUMEAU du bandeau de panne (`JellyfinOutageNotice`) : le vrai lit l'état de Jellyfin sur le
 * canal de session, que le labo n'a pas. Même carte, mêmes propriétés, mêmes textes.
 */
function OutageTwin({ long }: { long: boolean }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-20 z-[60] flex justify-center px-4">
      <div className="pointer-events-auto w-[min(26rem,100%)]">
        <NoticeCard
          surface="player" severity={long ? "blocking" : "info"} icon="server"
          title={long ? "Jellyfin ne répond toujours pas" : "Jellyfin redémarre"}
          lines={[long ? "Votre position est gardée : la lecture reprendra dès son retour." : "La lecture reprendra toute seule, au même endroit."]}
          primary={long ? { label: "Réessayer", onClick: noop } : undefined}
          onClose={noop} countdown={long ? null : { secondsLeft: 6, progress: 0.4 } as never} durationMs={long ? null : 10_000}
        />
      </div>
    </div>
  );
}
