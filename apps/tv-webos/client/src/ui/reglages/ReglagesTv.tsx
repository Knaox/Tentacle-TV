import { useMemo } from "react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Palette, ShieldCheck, UserRound } from "lucide-react";
import { SettingsShell, type SettingsShellSection } from "@tentacle-tv/ui";

/**
 * Les réglages, ramenés à ce qu'un téléviseur peut offrir.
 *
 * La liste du client web en comptait cinq. Deux d'entre elles — Lecture et
 * Données — ouvraient l'écran « Indisponible » : leurs écrans ne sont pas
 * compilés dans ce bundle. Une section qui mène à une explication d'absence
 * n'est pas une section, c'est une cible qu'on vise pour rien, et la discipline
 * du parcours vaut ici comme ailleurs.
 *
 * En reste trois. Apparence et Sécurité sont celles du web, inchangées. La
 * troisième est nouvelle : elle recueille ce que la barre du haut emportait
 * avec elle en disparaissant — « À propos », et surtout la déconnexion, qui sur
 * un téléviseur veut dire oublier ce jumelage et revenir à la coquille.
 *
 * **Elle vit à `/settings/data`, et c'est délibéré.** Les routes sont déclarées
 * dans `App.tsx`, qu'on ne modifie pas ; l'identifiant d'une route de réglages
 * n'est affiché nulle part sur une dalle, et `SettingsData` était de toute
 * façon l'un des deux écrans indisponibles. On reprend sa place plutôt que
 * d'ajouter une route à un fichier partagé pour une cible sur neuf.
 */

const TAILLE_ICONE = 17;

/**
 * `/settings` n'a rien à montrer de lui-même : le rail de sections est déjà
 * rendu par la coquille, et un panneau de détail vide n'apprend rien. On entre
 * donc par Apparence.
 */
export function SettingsIndex() {
  return <Navigate to="/settings/appearance" replace />;
}

export function SettingsLayout() {
  const { t } = useTranslation("preferences");
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const sections = useMemo<SettingsShellSection[]>(
    () => [
      { id: "appearance", label: t("sectionAppearance"), icon: <Palette size={TAILLE_ICONE} /> },
      { id: "security", label: t("sectionSecurity"), icon: <ShieldCheck size={TAILLE_ICONE} /> },
      { id: "data", label: t("sectionAccount"), icon: <UserRound size={TAILLE_ICONE} /> },
    ],
    [t],
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
        onSelect={(id) => navigate(`/settings/${id}`)}
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
