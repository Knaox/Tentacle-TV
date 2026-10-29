/**
 * Octave — la pile d'avatars d'une playlist partagée : les photos (ou l'initiale) des personnes qui y ont accès,
 * propriétaire en tête, qui se chevauchent ; au-delà de `max`, « +N ». Les noms ne vivent pas qu'au survol : le
 * libellé accessible les dit tous, et la feuille « Personnes » les montre en clair.
 */

import { memo } from "react";
import type { MusicPlaylistPerson } from "@tentacle-tv/shared/music";
import { UserAvatar } from "../../../../components/ui/UserAvatar";

interface PeopleStackProps {
  people: readonly MusicPlaylistPerson[];
  size?: number;
  max?: number;
}

export const PeopleStack = memo(function PeopleStack({ people, size = 22, max = 3 }: PeopleStackProps) {
  const shown = people.slice(0, max);
  const more = people.length - shown.length;
  return (
    <span className="inline-flex items-center" aria-hidden>
      {shown.map((person, i) => (
        <span
          key={person.userId}
          className="rounded-full ring-2 ring-[var(--oc-ink,#0d0b13)]"
          style={{ marginLeft: i === 0 ? 0 : -Math.round(size / 3), zIndex: max - i }}
          title={person.name}
        >
          <UserAvatar userId={person.userId} name={person.name} hasAvatar={person.imageTag !== null} imageTag={person.imageTag || undefined} size={size} />
        </span>
      ))}
      {more > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-fill-medium font-semibold text-content-secondary ring-2 ring-[var(--oc-ink,#0d0b13)]"
          style={{ width: size, height: size, marginLeft: -Math.round(size / 3), fontSize: Math.max(10, Math.round(size * 0.42)) }}
        >
          +{more}
        </span>
      )}
    </span>
  );
});
