import { Navigate } from "react-router-dom";
import { useIsMobile } from "../hooks/useIsMobile";
import { PageTransition } from "../components/PageTransition";
import { ProfileHero } from "../components/profile-mobile/ProfileHero";
import { ProfileLinks } from "../components/profile-mobile/ProfileLinks";
import { AdminQuickActions } from "../components/profile-mobile/AdminQuickActions";
import { AccountActions } from "../components/profile-mobile/AccountActions";
import { getUserInfo } from "../components/userMenu/menuItems";

/**
 * Page Profile mobile — hub utilisateur complet pour viewport < 768px.
 *
 * Sur desktop, redirige vers `/settings` pour préserver l'UX existante (le
 * profil desktop est exposé via UserAvatarMenu dropdown du TopNav).
 *
 * Sections : Hero (avatar + nom + admin badge) → Admin quick actions (si admin)
 * → Liens (Préférences, Admin, Pair, About, Help, Crédits) → Account actions
 * (changer serveur Tauri, vider cache, déconnexion).
 */
export function MobileProfile() {
  const isMobile = useIsMobile();
  const { name, initial, isAdmin } = getUserInfo();

  // Cohérence UX : sur desktop, le profile s'expose via UserAvatarMenu, donc on
  // route les utilisateurs desktop vers la page Préférences complète.
  if (!isMobile) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-24">
        <div className="mx-auto max-w-2xl space-y-5">
          <ProfileHero name={name} initial={initial} isAdmin={isAdmin} />
          {isAdmin && <AdminQuickActions />}
          <ProfileLinks isAdmin={isAdmin} />
          <AccountActions />
        </div>
      </div>
    </PageTransition>
  );
}
