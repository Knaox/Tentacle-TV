import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { waitingNotice } from "@tentacle-tv/shared";
import { useWatchTogether } from "./WatchTogetherProvider";
import { memberStatus, WtAvatar } from "./WatchTogetherRows";
import { usePlayerGlassMode } from "../components/player/glass/PlayerGlassContext";
import { isGlassLayout } from "../components/player/glass/playerGlassMode";
import { GlassSurface } from "../components/player/glass/GlassSurface";

/**
 * Overlay discret du player en mode groupe : rangée d'avatars des membres
 * (ring de statut : lecture/buffering/erreur/hors ligne) en haut à droite, et
 * chip centrale pendant une attente (« En attente de X… », « X met en mémoire
 * tampon… », « Synchronisation… »).
 * Les avatars suivent la visibilité des contrôles du player (`controlsVisible`) ;
 * la chip group-wait reste toujours affichée (information de blocage).
 *
 * Couleurs volontairement en dur : posé directement sur la vidéo (rendu en
 * sibling de <VideoPlayer> dans WatchWeb/WatchDesktop) — texte blanc et fond
 * sombre quel que soit le thème, comme les contrôles du lecteur.
 */
export function GroupPlaybackOverlay({
  itemId,
  controlsVisible = true,
}: {
  itemId: string | undefined;
  /** Overlay lecteur (contrôles) actuellement affiché. */
  controlsVisible?: boolean;
}) {
  const { room, selfId } = useWatchTogether();
  const { t } = useTranslation("watchTogether");
  // Lecteur de bureau en verre : avatars et puce d'attente dans des capsules de verre.
  const glass = isGlassLayout(usePlayerGlassMode());

  if (!room || !itemId || room.itemId !== itemId) return null;

  // L'attente DES AUTRES (mon propre chargement a déjà son spinner), dite par la
  // règle commune au mobile (`waitingNotice`, shared) : « En attente de X… »
  // pour un arrivant, « X met en mémoire tampon… », « Synchronisation… » pour
  // une barrière — même quand la salle est en pause utilisateur.
  const notice = waitingNotice(room, selfId);
  const avatars = room.members.map((m) => (
    <WtAvatar
      key={m.userId}
      userId={m.userId}
      name={m.username}
      hasAvatar={m.hasAvatar}
      size={28}
      status={memberStatus(m)}
    />
  ));

  return (
    <>
      {/* Avatars membres — sous le header du player, à droite. Même fondu que
          les contrôles : visibles uniquement quand l'overlay lecteur est actif. */}
      {glass ? (
        <div className="lgp-wt-members">
          <GlassSurface className="lgp-wt-capsule" present={controlsVisible}>
            <div className="lgp-content flex items-center gap-1.5 px-2 py-1.5">{avatars}</div>
          </GlassSurface>
        </div>
      ) : (
        <div className={`pointer-events-none absolute right-4 top-16 z-20 flex items-center gap-1.5 transition-opacity duration-300 md:right-6 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
          {avatars}
        </div>
      )}

      {/* Chip group-wait */}
      <AnimatePresence>
        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2"
          >
            {glass ? (
              <GlassSurface className="lgp-wt-capsule" group="player-wt" transition={0}>
                <div className="flex items-center gap-2.5 px-4 py-2">
                  <div className="lgp-wt-spinner h-3.5 w-3.5 animate-spin rounded-full border-2" />
                  <span className="lgp-wt-text text-sm">{t(notice.key, notice.params)}</span>
                </div>
              </GlassSurface>
            ) : (
              <div
                /* Flou en CLASSE : un style en ligne échappe à la passe de
                   verre du téléviseur (cf. `Toast.tsx`). */
                className="flex items-center gap-2.5 rounded-full px-4 py-2 backdrop-blur-md"
                style={{
                  background: "rgba(15,15,25,0.85)",
                  border: "1px solid rgba(251,191,36,0.3)",
                }}
              >
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-400/40 border-t-amber-400" />
                <span className="text-sm text-white/85">{t(notice.key, notice.params)}</span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
