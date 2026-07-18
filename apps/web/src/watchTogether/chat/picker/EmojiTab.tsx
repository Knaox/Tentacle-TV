import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EMOJI_CATEGORIES } from "./emojiData";

/**
 * Watch Together — onglet Emojis du sélecteur : chips de catégories (saut par
 * ancre) + grille scrollable. Le clic envoie IMMÉDIATEMENT la réaction et ne
 * ferme JAMAIS le sélecteur : le spam d'emojis est un usage voulu.
 *
 * Couleurs volontairement en dur : section du panneau de chat (ChatPanel),
 * qui garde son verre sombre quel que soit le thème.
 */

export const EmojiTab = memo(function EmojiTab({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation("watchTogether");
  const listRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToCategory = (id: string) => {
    const list = listRef.current;
    const section = sectionRefs.current[id];
    // offsetTop relatif au conteneur scrollable (position: relative).
    if (list && section) list.scrollTo({ top: section.offsetTop, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 items-center justify-between gap-0.5 overflow-x-auto px-2 pb-1">
        {EMOJI_CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => scrollToCategory(cat.id)}
            title={t(cat.labelKey)}
            aria-label={t(cat.labelKey)}
            className="shrink-0 rounded-lg px-1 py-0.5 text-base transition-colors hover:bg-white/10"
          >
            {cat.icon}
          </button>
        ))}
      </div>

      <div ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-2">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }}>
            <p className="pb-0.5 pt-2 text-[10px] font-semibold uppercase tracking-wide text-white/35">
              {t(cat.labelKey)}
            </p>
            <div className="grid grid-cols-8">
              {cat.emojis.map((emoji) => (
                <button
                  key={`${cat.id}:${emoji}`}
                  onClick={() => onPick(emoji)}
                  aria-label={emoji}
                  className="rounded-lg py-0.5 text-xl leading-7 transition-transform duration-100 hover:scale-125"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
