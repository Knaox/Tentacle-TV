import { useMemo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  useLikedPeople,
  useLikePerson,
  useUnlikePerson,
} from "@tentacle-tv/api-client";
import { castCredits, type CastCredit, type CastPerson } from "@tentacle-tv/shared";
import { HorizontalScrollRow } from "./HorizontalScrollRow";
import { RowHeader } from "./rows/RowHeader";
import { ActorLikeButton } from "./reco/ActorLikeButton";
import { PersonCreditCard } from "./person/PersonCreditCard";

interface CastRowProps {
  people: CastPerson[];
  /**
   * Page publique (liste partagée) : ni lien vers la filmographie ni « j'aime »
   * — le visiteur n'a pas de session, les deux mèneraient à la connexion. Les
   * personnes aimées ne sont alors même pas demandées au serveur.
   */
  readOnly?: boolean;
}

/**
 * « Casting et équipe » de la fiche : une rangée de portraits, l'équipe
 * d'abord (réalisation, création, scénario…), un filet, puis la distribution.
 * Chaque carte ouvre la filmographie de la personne (`/person/:id`).
 *
 * Les studios ne sont plus ici : ils vivent dans le bloc « Informations » de
 * la fiche, avec le reste de ce qui n'est pas une personne — page partagée
 * comprise.
 */
export function CastRow({ people, readOnly = false }: CastRowProps) {
  return readOnly ? <CastRowView people={people} readOnly /> : <LikableCastRow people={people} />;
}

/** Le casting de la vraie fiche : un cœur « j'aime » sur chaque acteur. */
function LikableCastRow({ people }: { people: CastPerson[] }) {
  // Personnes aimées (rangées « Avec {acteur} ») : le casting Jellyfin ne
  // connaît que le NOM — la correspondance se fait dessus, et le serveur
  // résout l'id TMDB au like.
  const { data: likedData } = useLikedPeople();
  const likePerson = useLikePerson();
  const unlikePerson = useUnlikePerson();
  const likedByName = new Map(
    (likedData?.people ?? []).map((p) => [p.name.toLowerCase(), p.personId])
  );
  const toggleLike = (person: CastCredit) => {
    const likedId = likedByName.get(person.name.toLowerCase());
    if (likedId != null) unlikePerson.mutate(likedId);
    else likePerson.mutate({ name: person.name });
  };

  return (
    <CastRowView
      people={people}
      actorOverlay={(credit) => (
        <div className="absolute right-1.5 top-1.5 h-7 w-7">
          <ActorLikeButton
            name={credit.name}
            liked={likedByName.has(credit.name.toLowerCase())}
            pending={likePerson.isPending || unlikePerson.isPending}
            onToggle={() => toggleLike(credit)}
          />
        </div>
      )}
    />
  );
}

function CastRowView({ people, readOnly = false, actorOverlay }: {
  people: CastPerson[];
  readOnly?: boolean;
  actorOverlay?: (credit: CastCredit) => ReactNode;
}) {
  const { t } = useTranslation("media");
  const { crew, actors } = useMemo(() => castCredits(people), [people]);

  if (!actors.length && !crew.length) return null;

  return (
    <section className="group/row" aria-label={t("media:castAndCrew")}>
      <RowHeader title={t("media:castAndCrew")} />
      <HorizontalScrollRow
        ariaLabel={t("media:castAndCrew")}
        wrapperClassName="mt-3"
        className="row-gutter gap-4 pb-2 pt-2"
      >
        <ul className="flex gap-4">
          {crew.map((credit) => <PersonCreditCard key={`crew-${credit.id}`} credit={credit} readOnly={readOnly} />)}
        </ul>
        {crew.length > 0 && actors.length > 0 && (
          <span aria-hidden className="my-2 w-px shrink-0 self-stretch bg-line-subtle" />
        )}
        <ul className="flex gap-4">
          {actors.map((credit) => (
            <PersonCreditCard key={credit.id} credit={credit} readOnly={readOnly} overlay={actorOverlay?.(credit)} />
          ))}
        </ul>
      </HorizontalScrollRow>
    </section>
  );
}
