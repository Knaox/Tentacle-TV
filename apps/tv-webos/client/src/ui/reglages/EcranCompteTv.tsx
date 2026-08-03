import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { notifyUserChange } from "@tentacle-tv/api-client";
import { oublierJumelage, revenirALaCoquille } from "../../auth/retourCoquille";

/**
 * Le compte, et la sortie.
 *
 * Deux actions vivaient dans le menu d'avatar de la barre du haut, que la
 * disposition téléviseur a remplacée : « À propos », dont la route existait
 * sans que rien n'y mène, et la déconnexion, qui n'avait plus aucun point
 * d'accès.
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
 * seraient indiscernables. Oublier reste donc local ; la liste des appareils
 * jumelés, elle, est déjà dans la section Sécurité.
 */

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
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();
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
    revenirALaCoquille();
  }, [confirme, queryClient]);

  const compte = nomDuCompte();

  return (
    <div className="flex flex-col gap-8">
      <dl className="flex flex-col gap-4">
        <Ligne intitule={t("tvCompteJumele")} valeur={compte ?? "—"} />
        <Ligne intitule={t("tvServeur")} valeur={window.location.host} />
        <Ligne intitule={t("tvVersion")} valeur={__APP_VERSION_WEB__} />
      </dl>

      <div className="flex flex-col items-start gap-4">
        <button
          type="button"
          onClick={() => navigate("/about")}
          className="rounded-full border border-line-strong bg-fill-subtle px-8 py-4 text-lg font-semibold text-content-primary"
        >
          {tNav("about")}
        </button>

        <div className="flex flex-col items-start gap-2">
          <button
            type="button"
            onClick={oublier}
            onBlur={() => setConfirme(false)}
            className="rounded-full border border-line-strong bg-fill-subtle px-8 py-4 text-lg font-semibold text-content-primary"
          >
            {confirme ? t("tvOublierConfirmer") : t("tvOublierTitre")}
          </button>
          <p className="max-w-xl text-base leading-relaxed text-content-tertiary">
            {t("tvOublierTexte")}
          </p>
        </div>
      </div>
    </div>
  );
}

function Ligne({ intitule, valeur }: { intitule: string; valeur: string }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-sm uppercase tracking-[0.08em] text-content-tertiary">{intitule}</dt>
      <dd className="text-xl font-semibold text-content-primary">{valeur}</dd>
    </div>
  );
}

export default EcranCompteTv;
