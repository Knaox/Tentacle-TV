import { memo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { EMOJI_CATEGORIES } from "@tentacle-tv/shared";

/**
 * Watch Together — l'onglet Emojis du sélecteur : les catégories (un saut par ancre), puis la
 * grille défilante. Le clic envoie IMMÉDIATEMENT la réaction et ne ferme JAMAIS le sélecteur :
 * la rafale d'emojis est un usage voulu.
 */

export const EmojiTab = memo(function EmojiTab({ onPick }: { onPick: (emoji: string) => void }) {
  const { t } = useTranslation("watchTogether");
  const listRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const scrollToCategory = (id: string) => {
    const list = listRef.current;
    const section = sectionRefs.current[id];
    // offsetTop relatif au conteneur défilant (position: relative).
    if (list && section) list.scrollTo({ top: section.offsetTop, behavior: "smooth" });
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="wtc-cats">
        {EMOJI_CATEGORIES.map((cat) => (
          <button key={cat.id} type="button" onClick={() => scrollToCategory(cat.id)} title={t(cat.labelKey)} aria-label={t(cat.labelKey)} className="wtc-cat">
            {cat.icon}
          </button>
        ))}
      </div>

      <div ref={listRef} className="wtc-picker__scroll">
        {EMOJI_CATEGORIES.map((cat) => (
          <div key={cat.id} ref={(el) => { sectionRefs.current[cat.id] = el; }}>
            <p className="wtc-picker__label">{t(cat.labelKey)}</p>
            <div className="wtc-emoji-grid">
              {cat.emojis.map((emoji) => (
                <button key={`${cat.id}:${emoji}`} type="button" onClick={() => onPick(emoji)} aria-label={emoji} className="wtc-emoji">
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
