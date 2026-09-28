import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { HeartHandshake, X } from "lucide-react";
import { useMirror } from "../../mirror/useFormFactor";
import { useWatchTogether } from "../WatchTogetherProvider";
import { dismissAffinityPill, openAffinity, useAffinityStore } from "./affinityStore";
import { KIND_LABEL_KEY, memberName } from "./affinityText";

/**
 * La pilule d'invitation : une séance d'affinité tourne dans la salle et je
 * n'y participe pas — « Participer ». Sur téléphone et tablette (le miroir
 * n'a pas de bouton Watch Together), elle sert aussi à y REVENIR.
 *
 * Jamais sur une page de lecture, jamais par-dessus la modale ; au-dessus de
 * la pilule « Lecture de groupe » quand les deux se montrent. Masquable pour
 * la séance. Pas de verre : un fond à 0,94 ne floute rien de visible.
 */
export function AffinityPill() {
  const { t } = useTranslation("watchTogether");
  const { room, selfId } = useWatchTogether();
  const { state, modal, pillDismissed } = useAffinityStore();
  const mirror = useMirror();
  const { pathname } = useLocation();
  const reduced = useReducedMotion() ?? false;

  const participant = !!state && state.participants.some((p) => p.userId === selfId);
  const visible = !!state && !!room && !modal.open && !pathname.startsWith("/watch/")
    && pillDismissed !== state.sessionId && (!participant || mirror);
  // Sur téléphone, au-dessus de la barre d'onglets ET de la bulle du chat du
  // groupe (même rangée, à droite : la croix passait dessous). Au bureau, la
  // pilule « Lecture de groupe en cours » occupe déjà le bas de l'écran.
  const playbackPill = !!room?.itemId && (room.members.some((m) => m.inPlayback) || room.waitingForUserIds.length > 0);
  const bottom = mirror ? "bottom-40" : playbackPill ? "bottom-20" : "bottom-5";

  return (
    <AnimatePresence>
      {visible && state && (
        <div className={`pointer-events-none fixed inset-x-0 ${bottom} z-40 flex justify-center px-4`}>
          <motion.div
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full py-1.5 pl-3 pr-1.5 text-white"
            style={{
              background: "rgba(15,15,25,0.94)",
              border: "1px solid rgba(139,92,246,0.35)",
              boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
            role="status"
          >
            <HeartHandshake aria-hidden className="h-4 w-4 shrink-0 text-purple-300" />
            <span className="min-w-0 truncate text-sm text-white/85">
              {/* Sur téléphone, le plus court : même « Affinité en cours · … » y
                  était tronqué, le bouton dit le reste. */}
              {mirror
                ? t("affinityPillShort", { kind: t(KIND_LABEL_KEY[state.kind]) })
                : participant
                  ? t("affinityPillResume", { kind: t(KIND_LABEL_KEY[state.kind]) })
                  : t("affinityPillInvite", { name: memberName(room, state.startedBy), kind: t(KIND_LABEL_KEY[state.kind]) })}
            </span>
            <button
              type="button"
              onClick={() => openAffinity("deck")}
              className="h-9 shrink-0 rounded-full bg-white px-4 text-xs font-bold text-black outline-none transition-colors hover:bg-white/85 focus-visible:ring-2 focus-visible:ring-purple-300"
            >
              {participant ? t("affinityResume") : t("affinityJoin")}
            </button>
            <button
              type="button"
              onClick={() => dismissAffinityPill(state.sessionId)}
              aria-label={t("affinityDismiss")}
              title={t("affinityDismiss")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/60 outline-none transition-colors hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-300"
            >
              <X aria-hidden className="h-4 w-4" />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
