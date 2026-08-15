import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useWatchTogether } from "./WatchTogetherProvider";
import { memberStatus, WtAvatar } from "./WatchTogetherRows";

/**
 * Overlay discret du player en mode groupe : rangée d'avatars des membres
 * (ring de statut : lecture/buffering/erreur/hors ligne) en haut à droite, et
 * chip centrale « X met en mémoire tampon… » pendant un group-wait.
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

  if (!room || !itemId || room.itemId !== itemId) return null;

  // Membres attendus par le group-wait, moi exclu (mon propre buffering a déjà
  // son spinner) — la chip ne concerne que l'attente DES AUTRES.
  const waitingOthers = room.waitingForUserIds
    .filter((id) => id !== selfId)
    .map((id) => room.members.find((m) => m.userId === id))
    .filter((m): m is NonNullable<typeof m> => !!m);
  const groupWait = room.pauseReason === "buffering" && waitingOthers.length > 0;

  return (
    <>
      {/* Avatars membres — sous le header du player, à droite. Même fondu que
          les contrôles : visibles uniquement quand l'overlay lecteur est actif. */}
      <div className={`pointer-events-none absolute right-4 top-16 z-20 flex items-center gap-1.5 transition-opacity duration-300 md:right-6 ${controlsVisible ? "opacity-100" : "opacity-0"}`}>
        {room.members.map((m) => (
          <WtAvatar
            key={m.userId}
            userId={m.userId}
            name={m.username}
            hasAvatar={m.hasAvatar}
            size={28}
            status={memberStatus(m)}
          />
        ))}
      </div>

      {/* Chip group-wait */}
      <AnimatePresence>
        {groupWait && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none absolute left-1/2 top-20 z-20 -translate-x-1/2"
          >
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
              <span className="text-sm text-white/85">
                {waitingOthers.length === 1
                  ? t("memberBuffering", { name: waitingOthers[0].username })
                  : t("membersBuffering", { count: waitingOthers.length })}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
