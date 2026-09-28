import { useEffect } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Info } from "lucide-react";
import { useWatchTogether } from "../WatchTogetherProvider";
import { WtAvatar } from "../WatchTogetherRows";
import { clearAffinityNotice, useAffinityStore } from "./affinityStore";

/** Le temps d'un fait à l'écran (3 à 5 s, comme un toast). */
const NOTICE_MS = 4_000;

/**
 * Ce que les autres viennent de faire — lancer l'affinité, la quitter,
 * écarter un match —, dit DANS la modale : un toast passerait sous son voile.
 * Posé en surimpression au-dessus de la pile, il ne prend aucune place à la
 * carte et ne capte rien (le glisser passe au travers) ; il s'efface seul.
 * Fond opaque, sans verre : posé sur l'affiche, il ne laisse rien
 * transparaître (à 0,94, la note de la carte passait au travers). L'entrée et
 * la sortie ne bougent que `transform` et `opacity` ; en mouvement réduit,
 * un fondu. Les lecteurs d'écran l'entendent par une région polie, stable.
 */
export function AffinityNotice() {
  const { notice } = useAffinityStore();
  const { room } = useWatchTogether();
  const reduced = useReducedMotion() ?? false;

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => clearAffinityNotice(notice.id), NOTICE_MS);
    return () => clearTimeout(timer);
  }, [notice]);

  const member = notice?.userId ? room?.members.find((m) => m.userId === notice.userId) : undefined;

  return (
    <>
      <div className="pointer-events-none absolute inset-x-0 top-2 z-30 flex justify-center px-6">
        <AnimatePresence initial={false}>
          {notice && (
            <motion.div
              key={notice.id}
              aria-hidden
              initial={reduced ? { opacity: 0 } : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0, transition: { duration: reduced ? 0.12 : 0.22, ease: "easeOut" } }}
              exit={reduced ? { opacity: 0, transition: { duration: 0.1 } } : { opacity: 0, y: -6, transition: { duration: 0.15, ease: "easeIn" } }}
              className="flex max-w-full items-center gap-2.5 rounded-2xl py-1.5 pl-1.5 pr-4 text-[13px] font-medium leading-snug text-white"
              style={{
                background: "rgb(15,15,25)",
                border: "1px solid rgba(139,92,246,0.35)",
                boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
              }}
            >
              {member ? (
                <WtAvatar userId={member.userId} name={member.username} hasAvatar={member.hasAvatar} size={24} />
              ) : (
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white/10 text-purple-200">
                  <Info className="h-3.5 w-3.5" />
                </span>
              )}
              <span className="min-w-0">{notice.text}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <p className="sr-only" role="status" aria-live="polite">
        {notice?.text ?? ""}
      </p>
    </>
  );
}
