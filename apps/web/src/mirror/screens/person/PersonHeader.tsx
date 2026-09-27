import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Heart } from "lucide-react";
import { creditRoleKey, formatCalendarDate, type CreditRole, type PersonLife } from "@tentacle-tv/shared";
import { PersonPortrait } from "../../../components/person/PersonPortrait";

interface Props {
  id: string;
  name: string;
  imageTag: string | null;
  life: PersonLife;
  roles: CreditRole[];
  countLabel: string | null;
  portraitW: number;
  like: { liked: boolean; pending: boolean; toggle: () => void };
}

/**
 * `PersonHeader` de l'app : portrait 2:3 à cheval sur le bas du décor (−55 %
 * de sa hauteur), métiers 11 en capitales (les deux premiers en violet
 * clair), nom 26/31 extra-gras, compte 13 ; puis les faits (libellé 10,5 en
 * capitales, valeur 14) et le cœur rond de 44.
 */
export const PersonHeader = memo(function PersonHeader({ id, name, imageTag, life, roles, countLabel, portraitW, like }: Props) {
  const { t, i18n } = useTranslation("media");
  const portraitH = Math.round(portraitW * 1.5);
  const locale = i18n.language || "fr";
  const facts: Array<{ label: string; value: string }> = [];
  if (life.born) {
    const age = life.age !== null && life.died === null ? ` · ${t("personAge", { count: life.age })}` : "";
    facts.push({ label: t("personBorn"), value: `${formatCalendarDate(life.born, locale)}${age}` });
  }
  if (life.died) {
    const age = life.age !== null ? ` · ${t("personAge", { count: life.age })}` : "";
    facts.push({ label: t("personDied"), value: `${formatCalendarDate(life.died, locale)}${age}` });
  }
  if (life.birthPlace) facts.push({ label: t("personBirthplace"), value: life.birthPlace });
  const likeLabel = like.liked ? t("unlikeActor", { name }) : t("likeActor", { name });

  return (
    <div>
      <div className="flex items-end gap-4 px-4" style={{ marginTop: -Math.round(portraitH * 0.55) }}>
        <PersonPortrait
          id={id}
          name={name}
          imageTag={imageTag}
          height={portraitH * 3}
          eager
          style={{ width: portraitW }}
          className="shrink-0 rounded-[12px] border-[0.5px] border-line-subtle"
        />
        <div className="min-w-0 flex-1 pb-1">
          <p className="line-clamp-2 text-[11px] font-semibold uppercase tracking-[1px] text-content-tertiary">
            {t("personKicker")}
            {roles.length > 0 && (
              <span className="text-brand-light"> · {roles.slice(0, 2).map((r) => t(creditRoleKey(r))).join(" · ")}</span>
            )}
          </p>
          <h1 className="mt-1 line-clamp-3 text-[26px] font-extrabold leading-[31px] tracking-[-0.5px] text-content-primary">{name}</h1>
          {countLabel && <p className="mt-1 text-[13px] font-medium text-content-tertiary">{countLabel}</p>}
        </div>
      </div>
      <div className="mt-4 flex items-start gap-3 px-4">
        <dl className="flex min-w-0 flex-1 flex-wrap gap-x-6 gap-y-2">
          {facts.map((f) => (
            <div key={f.label} className="max-w-full">
              <dt className="text-[10.5px] font-semibold uppercase tracking-[0.9px] text-content-quaternary">{f.label}</dt>
              <dd className="mt-0.5 text-[14px] font-medium text-content-secondary">{f.value}</dd>
            </div>
          ))}
        </dl>
        <button
          type="button"
          onClick={like.toggle}
          disabled={like.pending}
          aria-pressed={like.liked}
          aria-label={likeLabel}
          className={`mirror-press flex h-11 w-11 shrink-0 items-center justify-center rounded-full border ${
            like.liked ? "border-transparent bg-brand text-cta-brand-fg" : "border-line-strong bg-fill-subtle text-content-secondary"
          }`}
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <Heart size={18} fill={like.liked ? "currentColor" : "none"} aria-hidden />
        </button>
      </div>
    </div>
  );
});
