import { memo, useMemo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  useJellyfinClient,
  useLikedPeople,
  useLikePerson,
  useUnlikePerson,
} from "@tentacle-tv/api-client";
import { castCredits, creditRoleKey, initials, type CastCredit, type CastPerson } from "@tentacle-tv/shared";
import { HorizontalScrollRow } from "./HorizontalScrollRow";
import { RowHeader } from "./rows/RowHeader";
import { ActorLikeButton } from "./reco/ActorLikeButton";
import { FadeImage } from "./ui/FadeImage";
import { personPath } from "./person/personLink";

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
 * « Casting et équipe » de la fiche : une rangée de portraits RONDS, l'équipe
 * d'abord (réalisation, création, scénario…), un filet, puis la distribution.
 * Chaque portrait ouvre la filmographie de la personne (`/person/:id`).
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
        // Au coin du carré du portrait : sur le bord du rond, jamais sur le visage.
        <div className="absolute right-0 top-0 h-7 w-7">
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
        className="row-gutter gap-5 pb-2 pt-2"
      >
        <ul className="flex gap-5">
          {crew.map((credit) => <CastCard key={`crew-${credit.id}`} credit={credit} readOnly={readOnly} />)}
        </ul>
        {crew.length > 0 && actors.length > 0 && (
          <span aria-hidden className="my-2 w-px shrink-0 self-stretch bg-line-subtle" />
        )}
        <ul className="flex gap-5">
          {actors.map((credit) => (
            <CastCard key={credit.id} credit={credit} readOnly={readOnly} overlay={actorOverlay?.(credit)} />
          ))}
        </ul>
      </HorizontalScrollRow>
    </section>
  );
}

/**
 * Une personne du générique : son portrait en ROND (la couleur d'attente, puis
 * UN fondu — `FadeImage`), son nom, puis son personnage (acteur) ou ses métiers
 * (équipe). Tout le portrait mène à sa filmographie.
 *
 * Sans portrait — ou si l'image échoue —, ses initiales sur l'encre : elles
 * sont peintes SOUS l'image, qui les recouvre en arrivant. Le survol ne
 * déplace rien : un anneau DÉJÀ posé paraît en opacité. `overlay` reçoit ce
 * qui se pose sur le portrait (le cœur « j'aime ») — en frère du lien, jamais
 * dedans : pas de bouton dans un lien.
 */
const CastCard = memo(function CastCard({ credit, overlay, readOnly = false }: {
  credit: CastCredit;
  overlay?: ReactNode;
  /** Page publique : le portrait ne mène nulle part (pas de session). */
  readOnly?: boolean;
}) {
  const { t } = useTranslation("media");
  const client = useJellyfinClient();
  const subtitle = credit.crewRoles.length > 0
    ? credit.crewRoles.map((r) => t(creditRoleKey(r))).join(" · ")
    : credit.character;
  // 224 px demandés pour 112 affichés : net sur un écran dense.
  const url = credit.imageTag
    ? client.getImageUrl(credit.id, "Primary", { height: 224, quality: 85, tag: credit.imageTag })
    : null;

  const body = (
    <>
      <div className="relative mx-auto aspect-square w-24 overflow-hidden rounded-full bg-surface-3 md:w-28">
        <span aria-hidden className="absolute inset-0 flex items-center justify-center font-display text-2xl font-semibold text-content-tertiary">
          {initials(credit.name)}
        </span>
        {url !== null && (
          <FadeImage src={url} alt="" className="absolute inset-0" imgClassName="object-top" style={TRANSPARENT} />
        )}
        {!readOnly && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full opacity-0 shadow-[inset_0_0_0_2px_var(--text-primary)] transition-opacity duration-hover group-hover/actor:opacity-100"
          />
        )}
      </div>
      <p className="mt-2.5 line-clamp-2 text-sm font-semibold leading-snug text-content-primary">{credit.name}</p>
      {subtitle && <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-content-tertiary">{subtitle}</p>}
    </>
  );

  return (
    <li className="group/actor relative w-24 shrink-0 text-center md:w-28">
      {readOnly ? body : (
        <Link
          to={personPath({ Id: credit.id, Type: credit.linkRole })}
          aria-label={`${t("personOpen", { name: credit.name })}${subtitle ? ` — ${subtitle}` : ""}`}
          className="block rounded-card outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--border-focus)]"
        >
          {body}
        </Link>
      )}
      {overlay}
    </li>
  );
});

/** Le fond de la boîte d'image reste transparent : les initiales, dessous, tiennent la place. */
const TRANSPARENT = { backgroundColor: "transparent" } as const;
