import { useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { DetailView } from "../../../src/redesign/screens/detail/DetailView";
import type { BenchData } from "../data/benchData";
import { detailOf, ID, imagesOf } from "./detailScenes";
import type { BenchScene } from "./types";

/**
 * La fiche qui ARRIVE (`mouvement/fiche`) : One Piece, reprise en saison 11 —
 * la fiche la plus lourde du compte (saisons, 99 épisodes, casting) —
 * démontée une demi-seconde toutes les 2,5 s, puis remontée : l'entrée de
 * l'en-tête, l'image de fond qui se pose, le montage des rangées. Ce que
 * coûte une arrivée sur le fil d'interface (`bench:ui fps`), hors fondu de
 * la pile (natif, rendu par le serveur d'affichage).
 */

const CYCLE_MS = 2_500;
const GAP_MS = 500;

function ArrivingDetail({ data }: { data: BenchData }) {
  const [shown, setShown] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const step = (next: boolean) => {
      setShown(next);
      timer = setTimeout(() => step(!next), next ? CYCLE_MS - GAP_MS : GAP_MS);
    };
    timer = setTimeout(() => step(false), CYCLE_MS - GAP_MS);
    return () => clearTimeout(timer);
  }, []);
  const props = useMemo(() => detailOf(data, ID.onePiece), [data]);
  return <View style={styles.root}>{shown ? <DetailView {...props} /> : null}</View>;
}

export const MOTION_DETAIL_SCENE: BenchScene = {
  id: "mouvement/fiche",
  group: "Mouvement",
  label: "La fiche qui arrive (One Piece, toutes les 2,5 s)",
  settleMs: 1800,
  images: (data) => imagesOf(detailOf(data, ID.onePiece)),
  render: (data) => <ArrivingDetail data={data} />,
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#000" },
});
