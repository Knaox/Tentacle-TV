import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import {
  creditRoleKey, formatCalendarDate, type CreditRole, type PersonLife, type SearchMediaItem,
} from "@tentacle-tv/shared";
import { useBrokenImage } from "../../hooks/useBrokenImage";
import { markImageSeen, wasImageSeen } from "../../lib/seenImages";
import { PersonPortrait } from "./PersonPortrait";

interface PersonHeroProps {
  id: string;
  name: string;
  imageTag: string | null;
  life: PersonLife;
  /** Les métiers, les plus fréquents d'abord — la ligne au-dessus du nom. */
  roles: CreditRole[];
  /** Le titre qui prête son décor (cf. `backdropSource`), ou rien. */
  backdrop: SearchMediaItem | null;
  /** « 12 titres dans la bibliothèque », une fois connu. */
  countLabel: string | null;
  /** Posé à droite du nom : le cœur « j'aime ». */
  trailing?: React.ReactNode;
  /** La couleur d'attente du portrait (`itemImageColor`), quand le serveur la donne. */
  portraitColor?: string | null;
}

/**
 * L'en-tête de la page d'une personne : le décor emprunté à son titre le mieux
 * noté, son portrait, son nom, ses métiers et ce que Jellyfin sait de sa vie.
 *
 * Le décor est FIXE — ni ken burns ni flou ni lueur : il ne coûte qu'une image,
 * et le voile qui le recouvre en bas le rend au fond de page, dans les deux
 * thèmes (le texte est thémé, pas posé sur le média). Il paraît en un seul
 * fondu ; le portrait, sur sa couleur d'attente.
 */
export const PersonHero = memo(function PersonHero({
  id, name, imageTag, life, roles, backdrop, countLabel, trailing, portraitColor,
}: PersonHeroProps) {
  const { t, i18n } = useTranslation("media");
  const client = useJellyfinClient();
  const backdropUrl = backdrop ? client.getImageUrl(backdrop.Id, "Backdrop", { width: 1920, quality: 80 }) : null;
  const { broken, reportFailure } = useBrokenImage(backdropUrl);
  // L'état du décor suit son ADRESSE ; déjà vu pendant la séance, il est posé sans fondu.
  const [decor, setDecor] = useState(() => ({ url: backdropUrl, loaded: wasImageSeen(backdropUrl), instant: wasImageSeen(backdropUrl) }));
  if (decor.url !== backdropUrl) setDecor({ url: backdropUrl, loaded: wasImageSeen(backdropUrl), instant: wasImageSeen(backdropUrl) });
  const locale = i18n.language || "fr";

  const facts: Array<{ label: string; value: string }> = [];
  if (life.born) {
    const date = formatCalendarDate(life.born, locale);
    const age = life.age !== null && life.died === null ? ` · ${t("personAge", { count: life.age })}` : "";
    facts.push({ label: t("personBorn"), value: `${date}${age}` });
  }
  if (life.died) {
    const age = life.age !== null ? ` · ${t("personAge", { count: life.age })}` : "";
    facts.push({ label: t("personDied"), value: `${formatCalendarDate(life.died, locale)}${age}` });
  }
  if (life.birthPlace) facts.push({ label: t("personBirthplace"), value: life.birthPlace });

  return (
    <header className="relative">
      <div aria-hidden className="absolute inset-x-0 top-0 h-[52vh] min-h-[320px] overflow-hidden">
        {/* Le décor paraît en UN fondu, depuis l'encre de la page (déjà vu : là d'emblée). */}
        {backdropUrl !== null && !broken && (
          <img
            src={backdropUrl}
            alt=""
            decoding="async"
            draggable={false}
            onLoad={() => {
              markImageSeen(backdropUrl);
              setDecor((d) => (d.url === backdropUrl ? { ...d, loaded: true } : d));
            }}
            onError={reportFailure}
            className={`h-full w-full object-cover ${decor.instant ? "" : "transition-opacity duration-card ease-out"} ${decor.loaded ? "opacity-60" : "opacity-0"}`}
          />
        )}
        {/* Rendu au fond de page par le bas ET par la gauche, où vivent le
            portrait et le texte : le décor ne reste franc qu'en haut à droite. */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(0deg, var(--surface-0) 0%, color-mix(in srgb, var(--surface-0) 82%, transparent) 38%, color-mix(in srgb, var(--surface-0) 30%, transparent) 75%, color-mix(in srgb, var(--surface-0) 55%, transparent) 100%)," +
              "linear-gradient(90deg, color-mix(in srgb, var(--surface-0) 70%, transparent) 0%, transparent 60%)",
          }}
        />
      </div>

      <div className="relative flex flex-col gap-6 px-4 pt-24 sm:flex-row sm:items-end sm:gap-8 md:px-12 md:pt-[22vh]">
        <PersonPortrait
          id={id}
          name={name}
          imageTag={imageTag}
          height={640}
          eager
          color={portraitColor}
          className="w-36 shrink-0 rounded-tile shadow-elev-2 sm:w-44 md:w-56"
        />
        <div className="min-w-0 flex-1 pb-1">
          <p className="ui-eyebrow">
            {t("personKicker")}
            {roles.length > 0 && (
              <span className="text-content-secondary"> · {roles.slice(0, 3).map((r) => t(creditRoleKey(r))).join(" · ")}</span>
            )}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="min-w-0 break-words text-display-3 text-content-primary md:text-display-2">
              {name}
            </h1>
            {trailing}
          </div>
          {countLabel && <p className="mt-2 text-sm tabular-nums text-content-secondary">{countLabel}</p>}
          {facts.length > 0 && (
            <dl className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {facts.map((f) => (
                <div key={f.label} className="min-w-0">
                  <dt className="ui-eyebrow text-[11px]">{f.label}</dt>
                  <dd className="mt-1 text-sm tabular-nums text-content-secondary">{f.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>
    </header>
  );
});
