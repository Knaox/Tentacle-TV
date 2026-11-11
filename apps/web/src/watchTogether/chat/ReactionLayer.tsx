import { memo, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { reactionBursts, type ReactionBurst } from "@tentacle-tv/shared";
import type { WtFloatingReaction } from "@tentacle-tv/api-client";
import { duration, easeOut } from "../../theme/motion";
import "./chat.css";

/**
 * Watch Together — la couche des réactions éphémères (emoji ou GIF), en bas à droite de l'écran
 * (côté bulle de chat). Entièrement transparente aux interactions.
 *
 * # Une bulle STABLE par membre et par contenu (règle partagée `reactionBursts`)
 *
 * Le chat partagé fusionne une rafale en UNE entrée comptée, mais lui donne une nouvelle clé à
 * chaque réaction. Rendue par cette clé, la bulle RENAISSAIT à chaque clic : dix « 🔥 » de
 * suite faisaient dix bulles qui repartaient du bas l'une après l'autre (vu à deux comptes,
 * lot rf2). Ici la bulle garde sa place et son COMPTE pulse ; elle s'envole en s'effaçant quand
 * la rafale est finie.
 *
 * # Une voie LIBRE, tenue
 *
 * La règle partagée donne une voie par hachage (trois voies) : deux rafales peuvent tomber sur
 * la même et se dessiner l'une sur l'autre (vu : « 🔥 ×10 » sous un « ❤️ »). Le web a la place :
 * chaque bulle prend la première voie libre et la garde jusqu'à sa fin (`useLanes`).
 *
 * Couleurs en dur : elle flotte sur la vidéo comme sur n'importe quelle page — le nom doit
 * rester lisible sur n'importe quel fond.
 */

/** Écart entre deux voies : un emoji et son nom ; un GIF, plus large. */
const LANE_PX = 76;
const GIF_LANE_PX = 172;

/**
 * La voie de chaque bulle : la première libre à sa naissance, gardée tant qu'elle vit. Les
 * voies se comptent en pas d'emoji ; un GIF en occupe assez pour sa largeur.
 */
function useLanes(bursts: readonly ReactionBurst[]): Map<string, number> {
  const held = useRef(new Map<string, { at: number; span: number }>());
  return useMemo(() => {
    const alive = new Set(bursts.map((b) => b.id));
    for (const id of [...held.current.keys()]) if (!alive.has(id)) held.current.delete(id);
    for (const burst of bursts) {
      if (held.current.has(burst.id)) continue;
      const span = burst.gif ? Math.ceil(GIF_LANE_PX / LANE_PX) : 1;
      let at = 0;
      const taken = [...held.current.values()];
      while (taken.some((t) => at < t.at + t.span && t.at < at + span)) at += 1;
      held.current.set(burst.id, { at, span });
    }
    return new Map([...held.current].map(([id, lane]) => [id, lane.at]));
  }, [bursts]);
}

const Burst = memo(function Burst({ burst, lane, reduced }: { burst: ReactionBurst; lane: number; reduced: boolean }) {
  return (
    <motion.div
      // Elle naît en montant un peu ; elle part en s'envolant, plus vite qu'elle n'est venue.
      initial={{ opacity: 0, transform: reduced ? "none" : "translateY(14px) scale(0.9)" }}
      animate={{ opacity: 1, transform: reduced ? "none" : "translateY(0px) scale(1)", transition: { duration: duration.base, ease: easeOut } }}
      exit={{ opacity: 0, transform: reduced ? "none" : "translateY(-28px) scale(1)", transition: { duration: duration.menuIn, ease: easeOut } }}
      className="absolute bottom-24 flex flex-col items-center"
      style={{ right: 64 + lane * LANE_PX }}
    >
      {burst.gif ? (
        <img
          src={burst.gif.url}
          alt=""
          draggable={false}
          className="h-24 w-auto max-w-[160px] rounded-card object-cover"
          style={burst.gif.w && burst.gif.h ? { aspectRatio: `${burst.gif.w} / ${burst.gif.h}` } : undefined}
        />
      ) : (
        // La clé change à chaque réaction de la rafale : le compte rejoue sa pulsation, la bulle reste.
        <span key={burst.lastKey} className={`relative text-3xl drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)] ${burst.count > 1 ? "wtc-burst" : ""}`}>
          {burst.emoji}
          {burst.count > 1 && (
            <span className="absolute -right-5 -top-1 rounded-pill bg-[#18181B] px-1.5 text-[11px] font-bold tabular-nums leading-[18px] text-white">
              ×{burst.count}
            </span>
          )}
        </span>
      )}
      <span className="mt-0.5 max-w-[120px] truncate rounded-pill bg-[#18181B] px-1.5 text-[10px] font-medium leading-[16px] text-white/85">
        {burst.username}
      </span>
    </motion.div>
  );
});

export function ReactionLayer({ reactions }: { reactions: WtFloatingReaction[] }) {
  const reduced = useReducedMotion() === true;
  const bursts = useMemo(() => reactionBursts(reactions), [reactions]);
  const lanes = useLanes(bursts);
  return (
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden" aria-hidden data-wt-reactions>
      <AnimatePresence>
        {bursts.map((burst) => <Burst key={burst.id} burst={burst} lane={lanes.get(burst.id) ?? 0} reduced={reduced} />)}
      </AnimatePresence>
    </div>
  );
}
