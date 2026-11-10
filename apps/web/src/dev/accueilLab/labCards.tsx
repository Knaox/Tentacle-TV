/**
 * Les cartes du labo : les trois variantes du modèle partagé (`cardOverlay.ts`) — affiche 2:3,
 * vignette 16:9, recommandation —, chacune dans ses états de repos (rien, vu, favori, Ma
 * liste, en cours). Le survol est celui de la souris : le banc le capture par un vrai survol.
 */

import type { RecoRowItem } from "@tentacle-tv/shared";

import { labItems } from "./labItems";
import { EpisodeCard } from "../../components/cards/EpisodeCard";
import { PosterCard } from "../../components/cards/PosterCard";
import { RecoCard } from "../../components/reco/RecoCard";

const reco = (key: string, title: string, year: number, jellyfinItemId: string | null, extra: Partial<RecoRowItem> = {}): RecoRowItem => ({
  key,
  mediaType: "movie",
  tmdbId: key.length * 1000 + year,
  title,
  year,
  posterPath: null,
  jellyfinItemId,
  source: "similar",
  score: 0.8,
  voteAverage: 7.9,
  reasons: [],
  match: 86,
  ...extra,
});

const RECOS: RecoRowItem[] = [
  reco("movie:1", "Sueurs froides", 1958, "vertigo"),
  reco("movie:2", "Charade", 1963, "charade", { exploration: true }),
  reco("movie:3", "Le Faucon maltais", 1941, null),
];

function Group({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section data-lab-cards={id} className="row-gutter mb-10">
      <h2 className="mb-3 text-heading-2 text-content-primary">{title}</h2>
      <div className="flex flex-wrap items-start gap-4 pt-6">{children}</div>
    </section>
  );
}

export function LabCards() {
  return (
    <div data-lab-view="cartes" className="pt-4">
      <Group id="affiche" title="Affiche 2:3">
        {labItems("sprite", "sintel", "bbb", "charade", "vertigo").map((item, index) => (
          <PosterCard key={item.Id} item={item} index={index} />
        ))}
      </Group>
      <Group id="vignette" title="Vignette 16:9">
        {labItems("cam2", "tos", "sintel", "bbb").map((item, index) => (
          <EpisodeCard key={item.Id} item={item} index={index} />
        ))}
      </Group>
      <Group id="reco" title="Recommandation">
        {RECOS.map((item, index) => (
          <RecoCard key={item.key} item={item} index={index} />
        ))}
      </Group>
    </div>
  );
}
