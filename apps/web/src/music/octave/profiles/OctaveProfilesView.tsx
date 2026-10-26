/**
 * Octave — « Gérer les profils », une page DANS Octave (`/octave/profiles`) : avant, le menu du profil menait à
 * Réglages › Famille de Tentacle, et l'on sortait de la musique (Damien, 26/10). C'est un MIROIR, jamais une copie :
 * le corps est la page Famille de Tentacle elle-même (`SettingsFamily` — mêmes données `GET /api/family`, mêmes gestes,
 * mêmes règles partagées, le serveur qui revérifie tout), rendue sous l'en-tête d'Octave. Rien à y faire (pas de
 * famille, serveur d'avant) : retour aux Réglages d'Octave, jamais une page de Tentacle.
 *
 * La pastille dit la portée : ce qui se règle ici vaut pour le COMPTE et sa famille, dans Octave comme dans Tentacle.
 * La page Famille est chargée à la demande (le même morceau que Tentacle), seulement quand on ouvre la page.
 */

import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Shimmer } from "@tentacle-tv/ui";
import { ScopeBadge } from "../../../components/settings/ScopeBadge";
import { SettingsFamily } from "../../../lazyPages";
import { octavePaths } from "../octavePaths";

export function OctaveProfilesView() {
  const { t } = useTranslation("octaveShell");
  return (
    <div className="mx-auto max-w-2xl px-4 pb-10 pt-8 md:px-8" data-octave-profiles>
      <p className="oc-eyebrow">{t("settings.kicker")}</p>
      <h1 className="oc-display mt-2 text-4xl text-content-primary md:text-5xl">{t("profiles.title")}</h1>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-sm leading-relaxed text-content-tertiary">
        <ScopeBadge scope="account" />
        {t("profiles.lead")}
      </p>
      <div className="mt-8">
        <Suspense fallback={<ProfilesSkeleton />}>
          <SettingsFamily exitTo={octavePaths.settings} />
        </Suspense>
      </div>
    </div>
  );
}

/** La place de la page, le temps de charger son morceau : rien ne saute à l'arrivée. */
function ProfilesSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      <Shimmer width="75%" height="16px" />
      <Shimmer height="160px" />
    </div>
  );
}
