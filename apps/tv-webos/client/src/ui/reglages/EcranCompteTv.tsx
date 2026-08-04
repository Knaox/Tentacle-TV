import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { notifyUserChange, useJellyfinClient, useUserId } from "@tentacle-tv/api-client";
import { oublierJumelage, rendreLaMainAuTeleviseur } from "../../auth/retourCoquille";

/**
 * Le compte : qui regarde, et comment cesser de l'être.
 *
 * L'écran montrait aussi le serveur et la version. Ils sont partis à « À
 * propos », qui est l'endroit où on va les chercher. Ce qui reste est un
 * profil — le portrait et le nom, en grand — et la seule action qu'un
 * téléviseur ait à offrir sur un compte.
 *
 * **Se déconnecter n'a pas le même sens ici.** Il n'y a pas de mot de passe à
 * ressaisir sur un téléviseur : l'authentification vient du jumelage. La seule
 * chose que « se déconnecter » puisse vouloir dire est donc « oublier ce
 * jumelage » — effacer le jeton d'appareil et rendre la main à la coquille, qui
 * redemandera un code au relais.
 *
 * La confirmation est une seconde pression sur le même bouton plutôt qu'une
 * boîte de dialogue : sur une télécommande, un dialogue demande de retrouver le
 * bouton d'annulation, et le nôtre serait le premier piège à focus de
 * l'application. Deux appuis sur une cible qu'on a déjà sous le doigt disent la
 * même chose et se défont d'un appui sur Retour.
 *
 * Ce que l'écran n'appelle PAS : la révocation côté serveur. Elle existe
 * (`DELETE /api/pair/my-devices/:id`) mais réclame l'identifiant de l'appareil,
 * que le client ne connaît pas — et deux téléviseurs de la même marque y
 * seraient indiscernables. Oublier reste donc local.
 */

/** Le portrait, à la taille d'une dalle regardée de loin. */
const TAILLE_PORTRAIT = 132;

function nomDuCompte(): string | null {
  try {
    const brut = localStorage.getItem("tentacle_user");
    if (!brut) return null;
    const nom = (JSON.parse(brut) as { Name?: unknown }).Name;
    return typeof nom === "string" && nom.length > 0 ? nom : null;
  } catch {
    return null;
  }
}

export function EcranCompteTv() {
  const { t } = useTranslation("pairing");
  const queryClient = useQueryClient();
  const [confirme, setConfirme] = useState(false);

  const oublier = useCallback(() => {
    if (!confirme) {
      setConfirme(true);
      return;
    }
    oublierJumelage();
    queryClient.clear();
    notifyUserChange();
    // Puis on quitte, pour que la relance reparte de la coquille et de son
    // code. Au navigateur, où la plateforme ne sait pas quitter, l'appel est
    // sans effet : la purge suffit à renvoyer sur l'écran « non jumelé », qui
    // explique la marche à suivre.
    rendreLaMainAuTeleviseur();
  }, [confirme, queryClient]);

  const compte = nomDuCompte();

  return (
    // Blocs espacés par des marges sur des éléments NEUTRES : la passe des
    // écarts pose une marge négative sur tout conteneur à `gap`, et elle
    // l'emporterait sur l'espacement que son parent lui destine. Voir la note
    // détaillée dans `EcranAProposTv.tsx`.
    <div>
      <section className="mb-14">
        <Profil nom={compte} />
      </section>

      <section>
        <button
          type="button"
          onClick={oublier}
          onBlur={() => setConfirme(false)}
          className="rounded-full border border-line-strong bg-fill-subtle px-8 py-4 text-lg font-semibold text-content-primary"
        >
          {confirme ? t("tvOublierConfirmer") : t("tvOublierTitre")}
        </button>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-content-tertiary">
          {t("tvOublierTexte")}
        </p>
      </section>
    </div>
  );
}

/**
 * Le portrait et le nom.
 *
 * L'image vient de Jellyfin, par le proxy du serveur — même URL que celle du
 * client web (`useAvatarUpload`), à ceci près qu'on ne la met pas en cache
 * local : un téléviseur ne passe pas hors ligne, il s'éteint.
 *
 * Le repli est l'initiale, comme partout ailleurs dans l'application. Il sert
 * deux fois : quand le compte n'a pas de portrait — Jellyfin répond alors 404 —
 * et quand l'image n'arrive pas. On ne peut pas distinguer les deux cas avant
 * d'avoir essayé, donc on essaie, et `onError` retombe sur l'initiale sans que
 * rien ne clignote : l'image n'est montée qu'une fois chargée.
 */
function Profil({ nom }: { nom: string | null }) {
  const { t } = useTranslation("pairing");
  const client = useJellyfinClient();
  const userId = useUserId();
  const [echoue, setEchoue] = useState(false);

  const url =
    userId && !echoue
      ? `${client.getBaseUrl()}/Users/${userId}/Images/Primary?maxWidth=${TAILLE_PORTRAIT * 2}&quality=90`
      : null;

  const initiale = (nom ?? "?").charAt(0).toUpperCase();

  return (
    <div className="flex items-center gap-8">
      <div
        className="flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{
          width: TAILLE_PORTRAIT,
          height: TAILLE_PORTRAIT,
          // L'anneau de marque plutôt qu'une bordure : il se pose sur l'image
          // sans en manger un pixel, et reste lisible sur un portrait clair
          // comme sur un portrait sombre.
          boxShadow: "var(--hero-frame-ring)",
          background: "linear-gradient(140deg, var(--brand), var(--brand-accent))",
        }}
      >
        {url ? (
          <img
            src={url}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setEchoue(true)}
          />
        ) : (
          <span className="text-5xl font-bold text-white">{initiale}</span>
        )}
      </div>

      <div>
        <p className="text-sm uppercase tracking-[0.08em] text-content-tertiary">
          {t("tvCompteJumele")}
        </p>
        <p className="mt-2 text-4xl font-bold tracking-tight text-content-primary">{nom ?? "—"}</p>
      </div>
    </div>
  );
}

export default EcranCompteTv;
