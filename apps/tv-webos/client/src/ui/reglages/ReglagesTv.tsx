import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Info, Play, UserRound } from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";

/**
 * Les réglages, ramenés à ce qu'un téléviseur peut offrir.
 *
 * Trois sections, et ce sont celles qu'on vient chercher sur une dalle :
 *
 * - **Compte** — qui est connecté, et comment oublier ce jumelage. C'est ce que
 *   la barre du haut emportait avec elle en disparaissant.
 * - **Lecture** — la langue de l'interface, et par bibliothèque l'audio et les
 *   sous-titres. Le seul réglage qu'on change vraiment, et qu'on changeait
 *   jusqu'ici depuis un autre appareil.
 * - **À propos** — la version, le serveur, l'appareil. Ce qu'on lit quand
 *   quelque chose ne va pas.
 *
 * Ce qui est parti, et pourquoi. **Apparence** proposait clair, sombre et auto :
 * un téléviseur n'a pas de réglage système à suivre, `prefers-color-scheme` n'y
 * est pas renseigné, et le mode clair n'a aucun emploi dans une pièce dont on a
 * baissé la lumière. Le thème est figé (`shims/themeSombre.ts`) et la section
 * n'a plus rien à régler. **Sécurité** regroupe un changement de mot de passe,
 * une liste d'appareils jumelés et un changement de serveur : trois gestes qui
 * demandent de la saisie suivie et qui se font depuis un ordinateur ou un
 * téléphone, en une minute, plutôt qu'à la télécommande.
 *
 * **Les adresses sont recyclées, et c'est délibéré.** Les routes sont déclarées
 * dans `App.tsx`, qu'on ne modifie pas ; l'identifiant d'une section de réglages
 * n'est affiché nulle part sur une dalle. On reprend donc les adresses libérées
 * plutôt que d'ajouter des routes à un fichier partagé pour une cible sur neuf :
 * `data` porte le Compte, `appearance` porte À propos, `playback` est déjà la
 * bonne adresse pour Lecture. Le tout se lit dans `pages/lazyPagesTv.ts`, qui
 * est le seul endroit à connaître cette correspondance.
 */

const TAILLE_ICONE = 17;

/** L'adresse de la première section : c'est par elle qu'on entre. */
const SECTION_INITIALE = "/settings/data";

/**
 * `/settings` n'a rien à montrer de lui-même : le rail de sections est déjà
 * rendu par la coquille, et un panneau de détail vide n'apprend rien.
 */
export function SettingsIndex() {
  return <Navigate to={SECTION_INITIALE} replace />;
}

export function SettingsLayout() {
  const { t } = useTranslation("preferences");
  const { t: tNav } = useTranslation("nav");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const sections = useMemo<SettingsShellSection[]>(
    () => [
      { id: "data", label: t("sectionAccount"), icon: <UserRound size={TAILLE_ICONE} /> },
      { id: "playback", label: t("sectionPlayback"), icon: <Play size={TAILLE_ICONE} /> },
      { id: "appearance", label: tNav("about"), icon: <Info size={TAILLE_ICONE} /> },
    ],
    [t, tNav],
  );

  const identifiantActif = useMemo(() => {
    const reste = pathname.replace(/^\/settings\/?/, "");
    return reste.split("/")[0] || null;
  }, [pathname]);

  const active = sections.find((section) => section.id === identifiantActif);

  return (
    <div className="pt-6">
      <SettingsShell
        sections={sections}
        activeId={identifiantActif}
        // `replace` et non un empilement : sur une dalle, Retour doit QUITTER
        // les réglages, pas remonter une à une les sections qu'on vient de
        // parcourir. Trois sections visitées, c'était trois appuis pour revenir
        // au catalogue — et rien à l'écran ne l'expliquait, puisque l'écran ne
        // change pas d'aspect entre deux sections.
        onSelect={(id) => navigate(`/settings/${id}`, { replace: true })}
        title={active ? active.label : t("settingsTitle")}
        description={undefined}
        onBack={() => navigate("/settings")}
        backLabel={t("back")}
      >
        <Outlet />
      </SettingsShell>
    </div>
  );
}
