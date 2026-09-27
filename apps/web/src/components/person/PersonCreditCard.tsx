import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { creditRoleKey, type CastCredit } from "@tentacle-tv/shared";
import { PersonPortrait } from "./PersonPortrait";
import { personPath } from "./personLink";

/**
 * Une personne du générique : portrait 2:3, nom, puis son personnage (acteur)
 * ou ses métiers (équipe, en couleur de marque). Toute la carte mène à sa
 * filmographie.
 *
 * Le survol ne touche ni l'ombre ni le cadre (peintures) : la carte monte d'un
 * cran par `transform`, et un liseré de marque DÉJÀ posé apparaît en opacité.
 * `overlay` reçoit ce qui se pose sur le portrait (le cœur « j'aime ») — en
 * frère du lien, jamais dedans : pas de bouton dans un lien.
 */
export const PersonCreditCard = memo(function PersonCreditCard({ credit, overlay, readOnly = false }: {
  credit: CastCredit;
  overlay?: ReactNode;
  /** Page publique : la carte ne mène nulle part (pas de session). */
  readOnly?: boolean;
}) {
  const { t } = useTranslation("media");
  const subtitle = credit.crewRoles.length > 0
    ? credit.crewRoles.map((r) => t(creditRoleKey(r))).join(" · ")
    : credit.character;

  const body = (
    <>
      <div className={`relative ${readOnly ? "" : "transition-transform duration-200 ease-out group-hover/actor:-translate-y-1 motion-reduce:transition-none"}`}>
        <PersonPortrait
          id={credit.id}
          name={credit.name}
          imageTag={credit.imageTag}
          height={320}
          className="rounded-[var(--radius-md)] ring-1 ring-line-subtle"
        />
        {!readOnly && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[var(--radius-md)] opacity-0 ring-2 ring-[rgba(var(--brand-rgb),0.7)] transition-opacity duration-200 group-hover/actor:opacity-100"
          />
        )}
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-content-primary">{credit.name}</p>
      {subtitle && (
        <p className={`line-clamp-1 text-xs ${credit.crewRoles.length > 0 ? "text-brand-light" : "text-content-tertiary"}`}>
          {subtitle}
        </p>
      )}
    </>
  );

  return (
    <li className="group/actor relative w-[7.5rem] shrink-0 md:w-[8.75rem]">
      {readOnly ? body : (
        <Link
          to={personPath({ Id: credit.id, Type: credit.linkRole })}
          aria-label={`${t("personOpen", { name: credit.name })}${subtitle ? ` — ${subtitle}` : ""}`}
          className="block rounded-[var(--radius-md)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]"
        >
          {body}
        </Link>
      )}
      {overlay}
    </li>
  );
});
