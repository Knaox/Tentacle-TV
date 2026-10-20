import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  setWtLogger, useWatchTogetherSession, WatchTogetherContext, type WtPlatformPort,
} from "@tentacle-tv/api-client";
import { useToast } from "../contexts/ToastContext";
import { GroupPlaybackPill } from "./GroupPlaybackPill";
import { InviteInboxModal } from "./InviteInboxModal";
import { ChatRoot } from "./chat/ChatRoot";
import { WatchTogetherRoomModal } from "./room/WatchTogetherRoomModal";
import { AffinityRoot } from "./affinity/AffinityRoot";
import { ElsewhereNotice } from "./ElsewhereNotice";
import { wtLog } from "./wtLog";

/**
 * Watch Together — la séance du web et du bureau, sous le Router. Tout ce qui
 * n'est pas de l'interface vit dans `@tentacle-tv/api-client`
 * (`useWatchTogetherSession`, le moteur, le chat, l'affinité), le même pour
 * le mobile : ici, les gestes de la plateforme (navigation, toasts, fermeture
 * de l'onglet) et les surfaces.
 */

// Les noms d'avant : chaque composant les lit d'ici (le client LG remplace ce
// fichier par un faux fournisseur, cf. `substitutionTable.ts`).
export { useWatchTogether, type WatchTogetherContextValue } from "@tentacle-tv/api-client";

// Le journal du moteur partagé : la console du web, en développement seulement.
setWtLogger(wtLog);

export function WatchTogetherProvider({ children }: { children: ReactNode }) {
  const { show } = useToast();
  const { t } = useTranslation("watchTogether");
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  /**
   * La boîte aux invitations, ouverte d'office à l'ACCUEIL.
   *
   * Là, on ne fait rien de précis : être interrompu ne coûte rien, et il ne
   * reste qu'à accepter. Ailleurs — une fiche qu'on lit, une lecture en cours —
   * l'invitation ne s'impose pas : le compteur du logo la garde sous la main.
   */
  const [inboxOpen, setInboxOpen] = useState(false);

  const port = useMemo<WtPlatformPort>(() => ({
    socketToken: typeof localStorage !== "undefined" ? localStorage.getItem("tentacle_token") : null,
    // Auto-follow : déjà sur un lecteur → REMPLACER l'entrée d'historique
    // (sinon chaque épisode du groupe s'empile et le bouton retour du lecteur
    // fait défiler les médias précédents au lieu de quitter la lecture).
    navigateToWatch: (itemId) => navigate(`/watch/${itemId}`, { replace: pathname.startsWith("/watch/") }),
    isOnWatchPage: (itemId) => pathname === `/watch/${itemId}`,
    isWatching: () => pathname.startsWith("/watch/"),
    toast: show,
    t: (key, opts) => t(key, opts) as string,
    onInviteArrived: () => { if (pathname === "/") setInboxOpen(true); },
    // Quitter Tentacle (fermeture d'onglet, d'app) = quitter le groupe vite.
    subscribeAppExit: (onExit) => {
      window.addEventListener("pagehide", onExit);
      return () => window.removeEventListener("pagehide", onExit);
    },
  }), [navigate, pathname, show, t]);

  const value = useWatchTogetherSession(port);

  // Plus rien à répondre (réponse donnée ici ou sur un autre appareil) : la
  // boîte se referme — sinon elle restait « ouverte » et la prochaine
  // invitation la faisait surgir par-dessus le lecteur.
  const noInvites = value.invites.length === 0;
  useEffect(() => {
    if (noInvites) setInboxOpen(false);
  }, [noInvites]);

  return (
    <WatchTogetherContext.Provider value={value}>
      {children}
      {inboxOpen && value.mayJoin && <InviteInboxModal onClose={() => setInboxOpen(false)} />}
      <WatchTogetherRoomModal />
      <GroupPlaybackPill />
      <ElsewhereNotice />
      {value.room && <ChatRoot />}
      {/* L'affinité (swipe de groupe) : remontée à chaque salle — ses numéros
          d'état repartent de zéro avec elle. */}
      {value.room && <AffinityRoot key={value.room.groupId} />}
    </WatchTogetherContext.Provider>
  );
}
