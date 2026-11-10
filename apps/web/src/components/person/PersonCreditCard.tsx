import { memo, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { creditRoleKey, type CastCredit } from "@tentacle-tv/shared";
import { PersonPortrait } from "./PersonPortrait";
import { personPath } from "./personLink";

/**
 * Une personne du générique : portrait 2:3, nom, puis son personnage (acteur)
 * ou ses métiers (équipe, un ton plus haut). Toute la carte mène à sa
 * filmographie.
 *
 * Le survol est celui des cartes de la refonte : le portrait grandit de 3 % SUR
 * PLACE (`transform`, 220 ms), sans ombre ni liseré animés.
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
      <div className={`relative ${readOnly ? "" : "transition-transform duration-card ease-out group-hover/actor:scale-[var(--card-hover-scale)] motion-reduce:transition-none"}`}>
        <PersonPortrait
          id={credit.id}
          name={credit.name}
          imageTag={credit.imageTag}
          height={320}
          className="rounded-card"
        />
      </div>
      <p className="mt-2 line-clamp-1 text-sm font-medium text-content-primary">{credit.name}</p>
      {subtitle && (
        <p className={`line-clamp-1 text-xs ${credit.crewRoles.length > 0 ? "text-content-secondary" : "text-content-tertiary"}`}>
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
          className="block rounded-card outline-none focus-visible:ring-2 focus-visible:ring-line-focus"
        >
          {body}
        </Link>
      )}
      {overlay}
    </li>
  );
});
