import { Image, StyleSheet } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { TrailerView, type TrailerViewProps } from "../../../src/redesign/screens/trailer/TrailerView";
import type { TrailerPanelModel } from "../../../src/redesign/screens/trailer/trailerTypes";
import type { BenchData } from "../data/benchData";
import { subtitleCue } from "../data/playerModels";
import type { BenchScene } from "./types";

/**
 * La bande-annonce d'un film du compte qui en a une (`RemoteTrailers`). Au
 * banc, l'image de l'œuvre tient lieu de vidéo : la vue ne reçoit le lecteur
 * que par son emplacement `video`. Le lecteur simplifié : la barre, et — chez
 * un serveur qui déclare `trailers.player` — [Sous-titres] [Qualité] et leurs
 * panneaux.
 */

function trailerItem(data: BenchData): MediaItem | undefined {
  const withTrailer = (it: MediaItem) =>
    ((it as { RemoteTrailers?: unknown[] }).RemoteTrailers?.length ?? 0) > 0 && !!data.image(it.Id, "Backdrop");
  return data.list("movies").find(withTrailer) ?? data.list("resume").find(withTrailer);
}

const TIMELINE = { position: 42, duration: 148, buffered: 71 };
const TOOLS = { subtitles: true, quality: true };

const SUBTITLES_PANEL: TrailerPanelModel = {
  kind: "subtitles",
  options: [
    { key: "off", label: "Désactivés", selected: false },
    { key: "fr", label: "Français", detail: "Générés automatiquement", selected: true },
    { key: "en-US", label: "Anglais", selected: false },
  ],
};

const QUALITY_PANEL: TrailerPanelModel = {
  kind: "quality",
  options: [
    { key: "auto", label: "Auto", selected: true },
    ...[1080, 720, 480, 360].map((height) => ({ key: String(height), label: `${height}p`, selected: false })),
  ],
};

type Variant = Omit<TrailerViewProps, "title" | "backdropUri" | "video">;

function Trailer({ data, ...variant }: { data: BenchData } & Variant) {
  const item = trailerItem(data);
  const backdrop = item ? data.image(item.Id, "Backdrop") : undefined;
  return (
    <TrailerView
      {...variant}
      title={item?.Name ?? ""}
      backdropUri={backdrop}
      video={backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : undefined}
    />
  );
}

const scene = (id: string, label: string, focusKeys: string[], variant: Variant): BenchScene => ({
  id: `bande-annonce/${id}`,
  group: "Bande-annonce",
  label,
  focusKeys,
  settleMs: 1400,
  render: (data) => <Trailer data={data} {...variant} />,
});

export const TRAILER_SCENES: BenchScene[] = [
  scene("lecture", "Lecture : barre, sous-titres, qualité", ["trailer:timeline", "trailer:subtitles", "trailer:quality", "trailer:close"], { state: "playing", timeline: TIMELINE, tools: TOOLS }),
  // Le serveur d'avant `trailers.player` : la barre seule, avancer et reculer.
  scene("ancien-serveur", "Lecture, serveur sans sous-titres ni qualité", ["trailer:timeline", "trailer:close"], { state: "playing", timeline: TIMELINE }),
  // La barre garde le focus pendant que le chrome s'estompe ; la croix reste à peine visible.
  scene("estompee", "Lecture, chrome estompé, sous-titre", ["trailer:timeline"], { state: "playing", timeline: TIMELINE, tools: TOOLS, chromeShown: false, subtitle: subtitleCue() }),
  scene("defilement", "Défilement : la barre seule, la cible visée", ["trailer:timeline"], { state: "playing", timeline: TIMELINE, tools: TOOLS, chromeShown: false, timelineShown: true, scrubTarget: 96 }),
  scene("saut", "Saut de +30 s", ["trailer:timeline"], { state: "playing", timeline: TIMELINE, tools: TOOLS, seekFlash: { forward: true, label: "+30 s" } }),
  scene("pause", "En pause", ["trailer:timeline"], { state: "playing", timeline: TIMELINE, tools: TOOLS, paused: true }),
  scene("sous-titres", "Panneau des sous-titres", ["trailerSubtitles:list:fr", "trailerSubtitles:close"], { state: "playing", timeline: TIMELINE, tools: TOOLS, panel: SUBTITLES_PANEL }),
  scene("qualite", "Panneau de la qualité", ["trailerQuality:list:auto", "trailerQuality:close"], { state: "playing", timeline: TIMELINE, tools: TOOLS, panel: QUALITY_PANEL }),
  // Le flux ne suit plus : la roue sur la dernière image.
  scene("attente", "Lecture qui attend le réseau", ["trailer:timeline"], { state: "playing", timeline: TIMELINE, tools: TOOLS, chromeShown: false, waiting: true }),
  scene("chargement", "Chargement", ["trailer:close"], { state: "loading" }),
  scene("indisponible", "YouTube ne la fournit pas", ["trailer:close"], { state: "unavailable" }),
  scene("illisible", "Vidéo hors YouTube, illisible sur ce téléviseur", ["trailer:close"], { state: "unavailable", unavailableReason: "unsupported" }),
];
