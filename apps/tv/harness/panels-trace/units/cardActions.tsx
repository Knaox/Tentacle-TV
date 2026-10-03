import { act } from "react";
import { useCardActions } from "@bench/src/redesignWiring/cards/useCardActions";
import { api, resetApi } from "../stubs/api-client";
import { note } from "../stubs/record";
import { mount, take } from "./root";

/**
 * Les actions d'une carte pour le grand panneau (`useCardActions`) : la note
 * (posée, en attente, rien à noter), le modèle du survol, la lecture — selon
 * ce que savent les requêtes — puis ce que fait chaque picto.
 */

type Actions = ReturnType<typeof useCardActions>;
let latest: Actions | null = null;

const MOVIE = { Id: "m1", Name: "Film", Type: "Movie", UserData: { PlaybackPositionTicks: 0 } };
const SERIES = { Id: "s1", Name: "Série", Type: "Series" };
const IDENTITY = { tmdbId: 42, mediaType: "movie" };

function Probe({ target, withActions = true }: { target: Parameters<typeof useCardActions>[0]; withActions?: boolean }) {
  latest = useCardActions(target, { withActions, onLeave: () => note({ leave: true }) });
  return null;
}

const view = (a: Actions | null) => (a ? { variant: a.variant, overlay: a.overlay, states: a.states, play: a.play, rating: a.rating } : null);

export async function runCardActions(): Promise<Record<string, unknown[]>> {
  const out: Record<string, unknown[]> = {};
  const scenario = async (name: string, target: Parameters<typeof useCardActions>[0], steps: Array<[string, Record<string, unknown> | null, ((a: Actions) => void)?]>, withActions = true) => {
    const bench = mount();
    resetApi();
    const trace: unknown[] = [];
    for (const [label, state, gesture] of steps) {
      if (state) Object.assign(api, state);
      bench.render(<Probe target={target} withActions={withActions} />);
      if (gesture && latest) bench.run(() => gesture(latest as Actions));
      await act(async () => {
        for (let i = 0; i < 5; i++) await Promise.resolve();
      });
      trace.push({ step: label, ...view(latest), events: take() });
    }
    bench.unmount();
    out[name] = trace;
  };

  await scenario("film de la bibliothèque", { kind: "media", item: MOVIE as never, variant: "poster" }, [
    ["fiche en route", { fullLoading: true }],
    ["fiche là, cible inconnue", { fullLoading: false, fullItem: MOVIE }],
    ["cible en résolution", { ratingPending: true }],
    ["cible sue, notes en route", { ratingPending: false, ratingIdentity: IDENTITY }],
    ["notes sues, aucune", { ratings: [] }],
    ["Ma liste", null, (a) => a.onAction("watchlist")],
    ["noter 7", null, (a) => a.onRate(7)],
    ["retirer", null, (a) => a.onRate(null)],
    ["la fiche", null, (a) => a.onAction("details")],
    ["demander : rien", null, (a) => a.onAction("request")],
  ]);
  await scenario("rien à noter", { kind: "media", item: MOVIE as never, variant: "landscape" }, [
    ["fiche là, aucune cible", { fullItem: MOVIE }],
    ["lire", { resolvePlay: "m1" }, (a) => a.onAction("play")],
  ]);
  await scenario("série, note seule (« Noter »)", { kind: "media", item: SERIES as never, variant: "poster" }, [
    ["fiche en route", { fullLoading: true }],
    ["fiche là", { fullLoading: false, fullItem: SERIES, ratingIdentity: { tmdbId: 7, mediaType: "tv" }, ratings: [] }],
  ], false);
  await scenario("reco hors bibliothèque", { kind: "reco", item: { key: "movie:9", title: "Reco", year: 2020, jellyfinItemId: null } as never }, [
    ["rien de su", {}],
    ["cible sue", { ratingIdentity: { tmdbId: 9, mediaType: "movie" }, ratings: [] }],
    ["ne plus me proposer", null, (a) => a.onAction("dismiss")],
    ["toutes les plateformes", null, (a) => a.onAction("providersAll")],
  ]);
  return out;
}
