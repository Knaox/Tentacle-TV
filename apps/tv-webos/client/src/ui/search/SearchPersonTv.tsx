import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials, personMeta, type SearchPersonHit } from "@tentacle-tv/shared";

/**
 * Un portrait rond — la photo de la personne, sinon ses initiales. Jamais une
 * requête vouée au 404 : sans `imageTag`, le serveur n'a pas de photo.
 */
export const SearchPortraitTv = memo(function SearchPortraitTv({ person, size }: {
  person: Pick<SearchPersonHit, "id" | "name" | "imageTag">;
  size: number;
}) {
  const client = useJellyfinClient();
  const uri = person.imageTag
    ? client.getImageUrl(person.id, "Primary", { height: size * 2, tag: person.imageTag, quality: 85 })
    : null;
  return (
    <span className="tv-search-portrait" style={{ width: size, height: size }} aria-hidden>
      {uri ? (
        <img src={uri} alt="" loading="lazy" decoding="async" draggable={false} />
      ) : (
        <span className="tv-search-portrait-initials" style={{ fontSize: Math.round(size * 0.3) }}>
          {initials(person.name)}
        </span>
      )}
    </span>
  );
});

const PORTRAIT_SIZE = 150;

/**
 * Une personne trouvée : portrait, nom, et ce qu'elle représente dans la
 * bibliothèque (« Interprétation — 12 titres »). L'appui ouvre sa
 * filmographie. Marquée `data-tv-carte` : c'est une carte de rangée comme les
 * affiches, la cible d'entrée d'une piste et le repère du défilement.
 */
const SearchPersonCardTv = memo(function SearchPersonCardTv({ person, onOpen }: {
  person: SearchPersonHit;
  onOpen: (person: SearchPersonHit, opener: HTMLElement) => void;
}) {
  const { t } = useTranslation("search");
  const self = useRef<HTMLButtonElement>(null);
  return (
    <button
      ref={self}
      type="button"
      data-tv-carte
      className="tv-search-person"
      aria-label={person.name}
      onClick={() => self.current && onOpen(person, self.current)}
    >
      <SearchPortraitTv person={person} size={PORTRAIT_SIZE} />
      <span className="tv-search-person-name">{person.name}</span>
      <span className="tv-search-person-meta">{personMeta(t, person)}</span>
    </button>
  );
});

/**
 * La rangée des personnes : une piste comme les autres (`data-tv-piste`) —
 * confinement horizontal, entrée par la première carte visible, défilement
 * suivi par le moteur.
 */
export const SearchPeopleRowTv = memo(function SearchPeopleRowTv({ people, onOpen }: {
  people: SearchPersonHit[];
  onOpen: (person: SearchPersonHit, opener: HTMLElement) => void;
}) {
  const { t } = useTranslation("search");
  return (
    <section className="tv-search-section" aria-label={t("people")}>
      <h2 className="tv-search-section-title">{t("people")}</h2>
      <div data-tv-piste className="tv-search-people scrollbar-hide">
        {people.map((person) => (
          <SearchPersonCardTv key={person.id} person={person} onOpen={onOpen} />
        ))}
      </div>
    </section>
  );
});
