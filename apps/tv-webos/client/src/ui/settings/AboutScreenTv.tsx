import { useTranslation } from "react-i18next";
import { TentacleLogo } from "@/components/ui/TentacleLogo";
import { InfoRowTv } from "./InfoRowTv";

/**
 * À propos — ce qu'on vient lire quand quelque chose ne va pas.
 *
 * C'est la page d'Android TV et d'Apple TV (`apps/tv/src/screens/AboutScreen.tsx`,
 * lue et jamais modifiée), transposée au client web : mêmes informations, même
 * ordre, mêmes chaînes. Le logo et le nom, la version, puis les trois lignes qui
 * répondent aux questions qu'on se pose vraiment — quel serveur, quel compte,
 * quel appareil — puis ce que fait l'application et sous quelle licence on la
 * lit.
 *
 * Elle n'est PAS la page `/about` du client web, qui reste atteignable et
 * affiche « Web » comme plateforme : `isDesktopApp()` répond faux ici, et rien
 * dans `apps/web` ne sait qu'un téléviseur existe — c'est précisément ce qu'on
 * veut préserver.
 *
 * **La version vient de `versions.json`, champ `webos`.** `vite.config.ts` la
 * grave dans `__APP_VERSION_WEB__` au build, et `scripts/ipk.mjs` la reporte
 * dans `appinfo.json` : le paquet installé sur le téléviseur et le client servi
 * par le serveur ne peuvent donc pas annoncer deux numéros différents.
 *
 * Rien n'est focusable ici. La discipline du parcours veut qu'on ne vise que ce
 * qui agit, et cette page n'agit pas : le rail de sections l'a déjà, et Retour
 * en sort.
 *
 * **Un piège de la cible, à connaître avant d'écrire une mise en page ici.** La
 * passe des écarts remplace `gap` par des marges : un demi-écart sur chaque
 * enfant, et une marge NÉGATIVE du même demi-écart sur le conteneur, pour que
 * les bords ne se creusent pas. Deux conteneurs à écart imbriqués l'un dans
 * l'autre entrent alors en conflit — l'enfant est à la fois « élément à espacer
 * par son parent » et « conteneur qui se rétracte », les deux règles ont la même
 * spécificité, et c'est l'ordre dans la feuille qui tranche. En pratique la
 * marge négative gagne et l'espacement du parent disparaît.
 *
 * D'où la discipline suivie ici : les blocs sont espacés par des marges
 * explicites posées sur des éléments NEUTRES, et `gap` ne sert qu'à l'intérieur
 * d'eux. Un élément ne cumule jamais les deux rôles.
 */

/** Le pendant de `TV_PLATFORM_LABEL` d'`apps/tv`, pour cette cible-ci. */
const PLATFORM = "LG webOS";

function accountName(): string {
  try {
    const raw = localStorage.getItem("tentacle_user");
    if (!raw) return "—";
    const nom = (JSON.parse(raw) as { Name?: unknown }).Name;
    return typeof nom === "string" && nom.length > 0 ? nom : "—";
  } catch {
    return "—";
  }
}

export function AboutScreenTv() {
  const { t } = useTranslation("about");
  const { t: tPairing } = useTranslation("pairing");

  const version = __APP_VERSION_WEB__;
  // Le client est servi par son propre serveur : son adresse est celle de la
  // page. Pas de `tentacle_server_url` à lire ici, contrairement à `apps/tv`
  // dont l'application est installée et doit se souvenir d'où elle se connecte.
  const server = window.location.host;

  const features = [
    t("featurePlayer"),
    t("featureResume"),
    t("featureRequests"),
    t("featureAdaptive"),
    t("featureNotifications"),
  ];

  return (
    <div>
      <section className="mb-12">
        <div className="flex items-center gap-6">
          <TentacleLogo size="lg" variant="glow" />
          <div>
            <p className="text-3xl font-bold tracking-tight text-content-primary">Tentacle TV</p>
            <p className="mt-1 text-base text-content-tertiary">{t("version", { version })}</p>
          </div>
        </div>
      </section>

      <section className="mb-12">
        <dl className="flex flex-col gap-5">
          <InfoRowTv intitule={tPairing("tvServeur")} value={server} />
          <InfoRowTv intitule={tPairing("tvCompteJumele")} value={accountName()} />
          <InfoRowTv intitule={tPairing("tvPlateforme")} value={PLATFORM} />
        </dl>
      </section>

      <p className="mb-12 max-w-3xl text-base leading-relaxed text-content-secondary">
        {t("description")}
      </p>

      <section className="mb-12">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-[0.08em] text-content-tertiary">
          {t("features")}
        </h2>
        <ul className="flex flex-col gap-3">
          {features.map((feature) => (
            <li key={feature} className="flex items-start gap-3">
              {/* La puce d'`apps/tv` : cinq pixels, la couleur de marque. Elle
                  aligne l'œil sans occuper de place. */}
              <span
                aria-hidden
                className="mt-2 h-[5px] w-[5px] flex-shrink-0 rounded-full"
                style={{ background: "var(--brand-accent)" }}
              />
              <span className="text-base leading-relaxed text-content-secondary">
                {feature}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <p className="text-sm text-content-tertiary">
        {t("copyright", { version, year: new Date().getFullYear() })}
      </p>
    </div>
  );
}

export default AboutScreenTv;
