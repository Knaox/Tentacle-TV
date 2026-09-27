import { useMemo } from "react";
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
  /** Studios à nommer sous la rangée — la page partagée, qui n'a pas de bloc « Informations ». */
  studios?: Array<{ Name: string; Id: string }>;
  /**
   * Page publique (liste partagée) : ni lien vers la filmographie ni « j'aime »
   * — le visiteur n'a pas de session, les deux mèneraient à la connexion.
   */
  readOnly?: boolean;
}

/**
 * « Casting et équipe » de la fiche : une rangée de portraits, l'équipe
 * d'abord (réalisation, création, scénario…), un filet, puis la distribution.
 * Chaque carte ouvre la filmographie de la personne (`/person/:id`).
 *
 * Les studios ne sont plus ici : ils vivent dans le bloc « Informations » de
 * la fiche, avec le reste de ce qui n'est pas une personne.
 */
export function CastRow({ people, studios, readOnly = false }: CastRowProps) {
  const { t } = useTranslation("media");
  const { crew, actors } = useMemo(() => castCredits(people), [people]);

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
            <PersonCreditCard
              key={credit.id}
              credit={credit}
              readOnly={readOnly}
              overlay={readOnly ? undefined : (
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
          ))}
        </ul>
      </HorizontalScrollRow>
      {studios && studios.length > 0 && (
        <p className="row-gutter mt-3 text-sm text-content-tertiary">
          <span className="text-content-quaternary">{t("media:studioLabel")} · </span>
          {studios.map((s) => s.Name).join(", ")}
        </p>
      )}
    </section>
  );
}
