import { Image, StyleSheet } from "react-native";
import type { MediaItem } from "@tentacle-tv/shared";
import { TrailerView } from "../../../src/redesign/screens/trailer/TrailerView";
import type { BenchData } from "../data/benchData";
import type { BenchScene } from "./types";

/**
 * La bande-annonce d'un film du compte qui en a une (`RemoteTrailers`). Au
 * banc, l'image de l'œuvre tient lieu de vidéo : la vue ne reçoit le lecteur
 * que par son emplacement `video`.
 */

function trailerItem(data: BenchData): MediaItem | undefined {
  const withTrailer = (it: MediaItem) =>
    ((it as { RemoteTrailers?: unknown[] }).RemoteTrailers?.length ?? 0) > 0 && !!data.image(it.Id, "Backdrop");
  return data.list("movies").find(withTrailer) ?? data.list("resume").find(withTrailer);
}

function Trailer({ data, state, dimmed = false }: { data: BenchData; state: "loading" | "playing" | "unavailable"; dimmed?: boolean }) {
  const item = trailerItem(data);
  const backdrop = item ? data.image(item.Id, "Backdrop") : undefined;
  return (
    <TrailerView
      state={state}
      title={item?.Name ?? ""}
      backdropUri={backdrop}
      chromeDimmed={dimmed}
      video={backdrop ? <Image source={{ uri: backdrop }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : undefined}
    />
  );
}

export const TRAILER_SCENES: BenchScene[] = [
  { id: "bande-annonce/lecture", group: "Bande-annonce", label: "Lecture, « Fermer » visible", focusKeys: ["trailer:close"], settleMs: 1400, render: (data) => <Trailer data={data} state="playing" /> },
  // Comme sur l'appareil : « Fermer » garde le focus pendant que le chrome s'estompe.
  { id: "bande-annonce/estompee", group: "Bande-annonce", label: "Lecture, chrome estompé", focusKeys: ["trailer:close"], settleMs: 1400, render: (data) => <Trailer data={data} state="playing" dimmed /> },
  { id: "bande-annonce/chargement", group: "Bande-annonce", label: "Chargement", focusKeys: ["trailer:close"], settleMs: 1400, render: (data) => <Trailer data={data} state="loading" /> },
  { id: "bande-annonce/indisponible", group: "Bande-annonce", label: "Indisponible sur ce téléviseur", focusKeys: ["trailer:close"], settleMs: 1400, render: (data) => <Trailer data={data} state="unavailable" /> },
];
