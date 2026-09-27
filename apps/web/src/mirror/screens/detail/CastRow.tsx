import { memo, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { castCredits, creditRoleKey, type CastCredit, type MediaItem } from "@tentacle-tv/shared";
import { PersonPortrait } from "../../../components/person/PersonPortrait";
import { personPath } from "../../../components/person/personLink";

type Person = NonNullable<MediaItem["People"]>[number];

const CARD_W = 96;

/**
 * `CastRow` de l'app : « Casting et équipe » (18 gras), une rangée de
 * portraits 2:3 de 96 × 144 (rayon `md`, écart 12) — l'équipe d'abord, ses
 * métiers en violet clair, un filet, puis la distribution et ses personnages.
 * Toucher une carte ouvre l'écran de la personne (`/person/:id`).
 */
export const CastRow = memo(function CastRow({ people }: { people: Person[] }) {
  const { t } = useTranslation("media");
  const navigate = useNavigate();
  const { crew, actors } = useMemo(() => castCredits(people), [people]);
  if (!crew.length && !actors.length) return null;

  const open = (c: CastCredit) => navigate(personPath({ Id: c.id, Type: c.linkRole }));

  return (
    <div className="mt-6">
      <h3 className="mb-3 px-4 text-[18px] font-bold leading-[23px] tracking-[-0.4px] text-content-primary">{t("castAndCrew")}</h3>
      <div className="mirror-no-scrollbar flex gap-3 overflow-x-auto overscroll-x-contain px-4">
        {crew.map((c) => <Card key={`crew-${c.id}`} credit={c} onOpen={open} />)}
        {crew.length > 0 && actors.length > 0 && <span aria-hidden className="my-2 w-px shrink-0 self-stretch bg-line-strong" />}
        {actors.map((c) => <Card key={c.id} credit={c} onOpen={open} />)}
      </div>
    </div>
  );
});

function Card({ credit, onOpen }: { credit: CastCredit; onOpen: (c: CastCredit) => void }) {
  const { t } = useTranslation("media");
  const isCrew = credit.crewRoles.length > 0;
  const subtitle = isCrew ? credit.crewRoles.map((r) => t(creditRoleKey(r))).join(" · ") : credit.character;
  return (
    <button
      type="button"
      onClick={() => onOpen(credit)}
      aria-label={`${credit.name}${subtitle ? `, ${subtitle}` : ""}`}
      title={t("personOpen", { name: credit.name })}
      className="mirror-detail-fade-press shrink-0 text-left"
      style={{ width: CARD_W }}
    >
      <PersonPortrait
        id={credit.id}
        name={credit.name}
        imageTag={credit.imageTag}
        height={288}
        style={{ width: CARD_W }}
        className="rounded-[8px] border-[0.5px] border-line-subtle"
      />
      <span className="mt-1.5 block truncate text-[13px] font-semibold text-content-primary">{credit.name}</span>
      {subtitle && (
        <span className={`mt-px block truncate text-[11.5px] font-medium ${isCrew ? "text-brand-light" : "text-content-tertiary"}`}>
          {subtitle}
        </span>
      )}
    </button>
  );
}
