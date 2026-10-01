import { ScrollView, StyleSheet, Text, View } from "react-native";
import { i18n, type MediaItem } from "@tentacle-tv/shared";
import { AmbientBackdrop } from "../../../src/redesign/background/AmbientBackdrop";
import { CARD_NOTE_SPACE } from "../../../src/redesign/cards/CardFocusNote";
import { Chip } from "../../../src/redesign/controls/Chip";
import { PillButton } from "../../../src/redesign/controls/PillButton";
import { RoundButton } from "../../../src/redesign/controls/RoundButton";
import { GlassSurface } from "../../../src/redesign/glass/GlassSurface";
import { MediaRow } from "../../../src/redesign/rows/MediaRow";
import { PosterGrid } from "../../../src/redesign/screens/library/PosterGrid";
import type { CardModel } from "../../../src/redesign/cards/cardTypes";
import { text } from "../../../src/redesign/theme/tokens";
import type { BenchData } from "../data/benchData";
import { cardOf, episodeLabel, resumeSubtitle, yearOf } from "../data/models";
import { byName } from "../data/playerModels";
import type { BenchScene } from "./types";

/**
 * Les briques seules, sur les vraies images : cartes 16:9, affiches, cartes
 * qui se redressent, grille, boutons, pastilles et verre — chacune figée au
 * focus tour à tour. C'est la planche « Briques » de la refonte. Les cartes
 * s'ouvrent par l'appui maintenu, comme dans l'app : leur focus le dit.
 */

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options) as string;
/** L'appui maintenu ouvre le grand panneau dans l'app ; au banc, seule son indication compte. */
const HOLD = () => undefined;
/** La raison d'une recommandation, pour l'exemple (le compte de test n'en a pas sous la main). */
const REASON = "Parce que vous avez aimé Arcane";

function Cards({ data }: { data: BenchData }) {
  const movies = data.list("movies", 8);
  const palette = cardOf(data, movies[0]).palette!;
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={palette} />
      <ScrollView contentContainerStyle={styles.page}>
        <MediaRow rowKey="land" title={t("common:resumeWatching")} variant="landscape" inset={96} onLongPressCard={HOLD}
          cards={data.list("resume", 6).map((it) => cardOf(data, it, resumeSubtitle(it)))} />
        <MediaRow rowKey="morph" title={t("common:latestAdditionsShort")} variant="morph" inset={96}
          cards={movies.map((it) => cardOf(data, it, yearOf(it)))} />
        <MediaRow rowKey="ep" title={t("common:nextEpisodes")} variant="landscape" inset={96} onLongPressCard={HOLD}
          cards={data.list("nextUp", 6).map((it) => cardOf(data, it, episodeLabel(it, true)))} />
      </ScrollView>
    </View>
  );
}

/**
 * Le logo d'une vignette sans Thumb, posé sur le fond (exemple) : partout où
 * il pourrait croiser un marqueur — avec la note ou sans, avec la barre de
 * « Reprendre » ou sans —, sur les deux cartes. Un logo opaque (le pavé noir
 * est dans le fichier de Jellyfin), deux larges, un étroit ; la légende dit
 * le cas.
 */
const LOGO_TITLES = ["Les Chevaliers du ciel", "Inception", "Interstellar", "Le Seigneur des anneaux : La Communauté de l'anneau"];

function logoCard(data: BenchData, item: MediaItem, rated: boolean, progress?: number): CardModel {
  const card = cardOf(data, item);
  return {
    ...card,
    subtitle: `${rated ? "note" : "sans note"} · ${progress !== undefined ? "progression" : "sans progression"}`,
    landscapeUri: data.image(item.Id, "Backdrop"),
    logoUri: data.image(item.Id, "Logo"),
    markers: rated ? card.markers : { ...card.markers, communityRating: null, userScore: null },
    progress,
  };
}

/** Deux rangées — avec la note, puis sans — de vignettes 16:9 (les deux
 *  premières avec la barre de « Reprendre ») ou de cartes qui se redressent. */
function Logos({ data, morph }: { data: BenchData; morph: boolean }) {
  const items = LOGO_TITLES.map((name) => byName(data, name)).filter((it): it is MediaItem => it !== undefined);
  if (items.length === 0) return null;
  const cards = (rated: boolean) => items.map((it, i) => logoCard(data, it, rated, !morph && i < 2 ? 0.35 : undefined));
  const key = morph ? "logoMorph" : "logo";
  const variant = morph ? "morph" : "landscape";
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cardOf(data, items[0]).palette!} />
      <ScrollView contentContainerStyle={styles.page}>
        <MediaRow rowKey={`${key}Note`} title={morph ? "Carte qui se redresse, avec note" : "Logo et note"} variant={variant} inset={96}
          onLongPressCard={HOLD} cards={cards(true)} />
        <MediaRow rowKey={`${key}Bare`} title={morph ? "Carte qui se redresse, sans note" : "Logo sans note"} variant={variant} inset={96}
          onLongPressCard={HOLD} cards={cards(false)} />
      </ScrollView>
    </View>
  );
}

function Posters({ data }: { data: BenchData }) {
  const series = data.list("series", 8);
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cardOf(data, series[0]).palette!} />
      <View style={styles.page}>
        {/* Une raison de recommandation (exemple) : elle passe avant l'indication. */}
        <View style={styles.withNotes}>
          <MediaRow rowKey="anime" title={t("nav:forYou")} variant="poster" inset={96} onLongPressCard={HOLD}
            cards={data.list("anime", 8).map((it) => ({ ...cardOf(data, it, yearOf(it)), focusNote: REASON }))} />
        </View>
        <MediaRow rowKey="poster" title={t("common:myList")} variant="poster" inset={96} onLongPressCard={HOLD}
          cards={series.map((it) => cardOf(data, it, yearOf(it)))} />
      </View>
    </View>
  );
}

function Grid({ data }: { data: BenchData }) {
  const cards = data.list("movies", 18).map((it) => cardOf(data, it, yearOf(it)));
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={cards[1]?.palette ?? cards[0].palette!} />
      <PosterGrid cards={cards} columns={6} focusPrefix="grille" onLongPressCard={HOLD} />
    </View>
  );
}

function Controls({ data }: { data: BenchData }) {
  const palette = cardOf(data, data.list("movies")[3]).palette!;
  return (
    <View style={styles.fill}>
      <AmbientBackdrop palette={palette} />
      <View style={[styles.page, styles.gapped]}>
        <Text style={text.title}>{t("common:play")} · {t("common:resume")}</Text>
        <View style={styles.row}>
          {/* La lecture porte la marque (`brand`) ; la pilule blanche reste celle d'un écran qui ne lit rien. */}
          <PillButton variant="brand" label={t("common:play")} icon="play" focusKey="btn:play" />
          <PillButton variant="brand" label={t("common:resume")} icon="play" progress={0.62} focusKey="btn:resume" />
          <PillButton variant="primary" label={t("common:retry")} icon="refresh" focusKey="btn:retry" />
          <PillButton variant="glass" label={t("common:trailer")} icon="trailer" focusKey="btn:trailer" />
          <PillButton variant="glass" label={t("common:moreInfo")} icon="info" size="md" focusKey="btn:info" />
        </View>
        <View style={styles.row}>
          <RoundButton icon="plus" activeIcon="check" label={t("common:myList")} focusKey="round:list" />
          <RoundButton icon="heart" label={t("common:myFavorites")} active focusKey="round:fav" />
          <RoundButton icon="check" label={t("cards:markWatched")} focusKey="round:seen" />
          <RoundButton icon="star" label={t("reco:yourRating")} focusKey="round:rate" />
        </View>
        <View style={styles.row}>
          <Chip label="Genres" detail="3" trailingIcon="chevronDown" focusKey="chip:genres" />
          <Chip label="Drame" selected trailingIcon="close" focusKey="chip:drama" />
          <Chip label="Trier par" detail="Titre A→Z" icon="sort" focusKey="chip:sort" />
          <Chip label="Saison 2" detail="22" size="md" focusKey="chip:season" />
        </View>
        <View style={styles.row}>
          <GlassSurface radius={32} style={styles.glassDemo}><Text style={text.body}>regular</Text></GlassSurface>
          <GlassSurface radius={32} tone="strong" style={styles.glassDemo}><Text style={text.body}>strong</Text></GlassSurface>
          <GlassSurface radius={32} tone="clear" style={styles.glassDemo}><Text style={text.body}>clear</Text></GlassSurface>
        </View>
      </View>
    </View>
  );
}

export const BRICK_SCENES: BenchScene[] = [
  { id: "briques/cartes", group: "Briques", label: "Cartes 16:9 et redressées", focusKeys: ["land:1", "morph:1", "morph:3", "ep:0"], settleMs: 1400, render: (data) => <Cards data={data} /> },
  { id: "briques/logos", group: "Briques", label: "Logo d'une vignette, avec ou sans note (exemple)", focusKeys: ["logoNote:0", "logoBare:1"], settleMs: 1400, render: (data) => <Logos data={data} morph={false} /> },
  // Le focus sur la DERNIÈRE carte de l'autre rangée : les logos restent au repos (le focus montre l'affiche).
  { id: "briques/logos-redresse", group: "Briques", label: "Logo d'une carte qui se redresse, avec ou sans note (exemple)", focusKeys: ["logoMorphBare:3", "logoMorphNote:3"], settleMs: 1400, render: (data) => <Logos data={data} morph /> },
  { id: "briques/affiches", group: "Briques", label: "Affiches, une raison de reco (exemple)", focusKeys: ["poster:2", "anime:0"], settleMs: 1400, render: (data) => <Posters data={data} /> },
  { id: "briques/grille", group: "Briques", label: "Grille d'affiches (6 colonnes)", focusKeys: ["grille:1", "grille:8"], settleMs: 1400, render: (data) => <Grid data={data} /> },
  {
    id: "briques/controles",
    group: "Briques",
    label: "Boutons, ronds, pastilles, verre",
    focusKeys: ["btn:play", "btn:resume", "btn:retry", "btn:trailer", "round:list", "round:fav", "chip:genres", "chip:drama"],
    render: (data) => <Controls data={data} />,
  },
];

const styles = StyleSheet.create({
  fill: { flex: 1 },
  page: { paddingTop: 70, paddingBottom: 120 },
  // La place de la raison sous la rangée (`CARD_NOTE_SPACE`, comme « Pour vous »).
  withNotes: { marginBottom: CARD_NOTE_SPACE },
  gapped: { paddingHorizontal: 96, gap: 44 },
  row: { flexDirection: "row", alignItems: "center", gap: 28 },
  glassDemo: { width: 300, height: 150, alignItems: "center", justifyContent: "center" },
});
