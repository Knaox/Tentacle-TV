import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import { initials, personMeta, type SearchFacetHit, type SearchPersonHit } from "@tentacle-tv/shared";
import { Rail } from "./SearchSection";

/**
 * `PersonAvatar` de l'app : un rond `brand.soft` bordé de `border.subtle`, la
 * photo Jellyfin quand elle existe, sinon les initiales en violet clair (0,34 × taille).
 */
export function PersonAvatar({ person, size }: { person: Pick<SearchPersonHit, "id" | "name" | "imageTag">; size: number }) {
  const client = useJellyfinClient();
  const [broken, setBroken] = useState(false);
  const uri = person.imageTag && !broken
    ? client.getImageUrl(person.id, "Primary", { height: size * 3, quality: 85 })
    : null;
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-line-subtle"
      style={{ width: size, height: size, background: "var(--brand-soft)" }}
    >
      {uri ? (
        <img src={uri} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <span className="font-bold text-brand-light" style={{ fontSize: size * 0.34 }}>{initials(person.name)}</span>
      )}
    </span>
  );
}

/**
 * `PeopleRail` de l'app : portrait 72, nom 13 semi-gras centré sur deux lignes,
 * « N titres » 11 ; colonnes de 84, 14 entre elles.
 */
export const PeopleRail = memo(function PeopleRail({ people, onOpen }: {
  people: SearchPersonHit[];
  onOpen: (person: SearchPersonHit) => void;
}) {
  const { t } = useTranslation("search");
  return (
    <Rail gap={14}>
      {people.map((person) => (
        <button
          key={person.id}
          type="button"
          onClick={() => onOpen(person)}
          aria-label={`${person.name}, ${personMeta(t, person)}`}
          className="flex w-[84px] shrink-0 flex-col items-center gap-1.5 active:opacity-70"
        >
          <PersonAvatar person={person} size={72} />
          <span className="line-clamp-2 text-center text-[13px] font-semibold leading-4 text-content-primary">{person.name}</span>
          <span className="-mt-0.5 truncate text-[11px] text-content-tertiary">{t("titles", { count: person.count })}</span>
        </button>
      ))}
    </Rail>
  );
});

/**
 * `FacetChips` de l'app : genres puis studios, une pastille 36 chacun — type
 * 10 en capitales, nom 13 semi-gras (180 max), compte 12.
 */
export const FacetChips = memo(function FacetChips({ genres, studios, onOpen }: {
  genres: SearchFacetHit[];
  studios: SearchFacetHit[];
  onOpen: (kind: "genre" | "studio", name: string) => void;
}) {
  const { t } = useTranslation("search");
  const chips = [
    ...genres.map((g) => ({ kind: "genre" as const, ...g })),
    ...studios.map((s) => ({ kind: "studio" as const, ...s })),
  ];
  return (
    <div className="flex flex-wrap gap-2 px-4">
      {chips.map((chip) => (
        <button
          key={`${chip.kind}:${chip.name}`}
          type="button"
          onClick={() => onOpen(chip.kind, chip.name)}
          aria-label={`${t(chip.kind)} ${chip.name}, ${t("titles", { count: chip.count })}`}
          className="flex h-9 items-center gap-1.5 rounded-full border border-line-subtle bg-fill-subtle px-3 active:opacity-70"
        >
          <span className="text-[10px] font-semibold uppercase tracking-[0.4px] text-content-tertiary">{t(chip.kind)}</span>
          <span className="max-w-[180px] truncate text-[13px] font-semibold text-content-primary">{chip.name}</span>
          <span className="text-xs font-medium text-content-tertiary">{chip.count}</span>
        </button>
      ))}
    </div>
  );
});
