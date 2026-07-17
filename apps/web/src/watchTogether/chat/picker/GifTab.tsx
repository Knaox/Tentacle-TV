import { memo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getUserInfo } from "../../../components/userMenu/menuItems";
import type { WtChatApi } from "../useWtChat";
import { useGifSearch, type GifItem } from "./useGifSearch";

/**
 * Watch Together — onglet GIF du sélecteur : recherche debouncée + grille de
 * tinygifs Tenor (tendances quand la recherche est vide). Un clic envoie le
 * GIF IMMÉDIATEMENT (comme un emoji) sans fermer le sélecteur ; un cooldown
 * client aligné sur le rate limit serveur évite les envois silencieusement
 * ignorés. Sans clé Tenor configurée : état explicite (CTA admin si admin).
 */

/** Aligné sur WT_MIN_GIF_INTERVAL_MS (serveur) — évite les drops silencieux. */
const GIF_SEND_COOLDOWN_MS = 1_500;

const GifCell = memo(function GifCell({
  gif, sent, onSend, sendLabel,
}: {
  gif: GifItem;
  sent: boolean;
  onSend: (gif: GifItem) => void;
  sendLabel: string;
}) {
  return (
    <button
      onClick={() => onSend(gif)}
      aria-label={sendLabel}
      className={`overflow-hidden rounded-lg transition-all hover:ring-1 hover:ring-purple-400/60 ${sent ? "ring-2 ring-purple-400" : ""}`}
    >
      <img
        src={gif.url}
        alt=""
        loading="lazy"
        draggable={false}
        className="w-full object-cover"
        style={gif.w && gif.h ? { aspectRatio: `${gif.w} / ${gif.h}` } : undefined}
      />
    </button>
  );
});

export const GifTab = memo(function GifTab({
  chat, onInputFocusChange,
}: {
  chat: WtChatApi;
  onInputFocusChange?: (focused: boolean) => void;
}) {
  const { t } = useTranslation("watchTogether");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useGifSearch(query);
  const lastSentRef = useRef(0);
  const [sentId, setSentId] = useState<string | null>(null);

  const sendGif = (gif: GifItem) => {
    const now = Date.now();
    if (now - lastSentRef.current < GIF_SEND_COOLDOWN_MS) return;
    lastSentRef.current = now;
    chat.sendGif({ url: gif.url, w: gif.w || undefined, h: gif.h || undefined });
    // Flash bref sur la vignette : accusé visuel local (l'écho serveur suit).
    setSentId(gif.id);
    setTimeout(() => setSentId((cur) => (cur === gif.id ? null : cur)), 700);
  };

  // Clé Tenor absente sur ce serveur : état explicite, pas de recherche.
  if (data && !data.configured) {
    const { isAdmin } = getUserInfo();
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-4 text-center">
        <p className="text-xs font-medium text-white/70">{t("gifNotConfigured")}</p>
        <p className="text-[11px] text-white/40">{t("gifNotConfiguredHint")}</p>
        {isAdmin && (
          <Link
            to="/admin/services"
            className="mt-1.5 rounded-lg bg-purple-500/25 px-2.5 py-1 text-[11px] font-semibold text-purple-200 transition-colors hover:bg-purple-500/40"
          >
            {t("gifNotConfiguredAdminCta")}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="shrink-0 px-2 pb-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          onKeyUp={(e) => e.stopPropagation()}
          onFocus={() => onInputFocusChange?.(true)}
          onBlur={() => onInputFocusChange?.(false)}
          maxLength={100}
          placeholder={t("gifSearchPlaceholder")}
          className="w-full rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs text-white placeholder-white/30 outline-none transition-colors focus:border-purple-400/50"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-1">
        {isLoading && !data ? (
          <div className="grid grid-cols-2 gap-1.5">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-white/5" />
            ))}
          </div>
        ) : data?.error ? (
          <p className="px-2 pt-8 text-center text-xs text-white/40">{t("gifError")}</p>
        ) : data && data.results.length === 0 ? (
          <p className="px-2 pt-8 text-center text-xs text-white/40">{t("gifNoResults")}</p>
        ) : (
          <div className="grid grid-cols-2 items-start gap-1.5">
            {data?.results.map((gif) => (
              <GifCell
                key={gif.id}
                gif={gif}
                sent={sentId === gif.id}
                onSend={sendGif}
                sendLabel={t("gifSendAria")}
              />
            ))}
          </div>
        )}
      </div>

      <p className="shrink-0 px-2 pb-1 text-right text-[9px] text-white/25">{t("gifAttribution")}</p>
    </div>
  );
});
