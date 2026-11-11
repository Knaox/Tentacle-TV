import { memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useGifSearch, type GifItem, type WtChatApi } from "@tentacle-tv/api-client";

/**
 * Watch Together — onglet GIF du sélecteur : recherche debouncée + grille de
 * tinygifs Klipy (tendances quand la recherche est vide). Un clic envoie le
 * GIF IMMÉDIATEMENT (comme un emoji) sans fermer le sélecteur ; un cooldown
 * client aligné sur le rate limit serveur évite les envois silencieusement
 * ignorés. La clé Klipy est au niveau application (image Docker) : l'état
 * « non disponible » ne concerne que les vieux serveurs / le dev sans .env.
 */

const GifCell = memo(function GifCell({
  gif, sent, onSend, sendLabel,
}: {
  gif: GifItem;
  sent: boolean;
  onSend: (gif: GifItem) => void;
  sendLabel: string;
}) {
  return (
    <button type="button" onClick={() => onSend(gif)} aria-label={sendLabel} className="wtc-gif" data-sent={sent}>
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

export const GifTab = memo(function GifTab({ chat, onRefused }: { chat: WtChatApi; onRefused?: () => void }) {
  const { t, i18n } = useTranslation("watchTogether");
  const [query, setQuery] = useState("");
  const { data, isLoading } = useGifSearch(query, i18n.language);
  const [sentId, setSentId] = useState<string | null>(null);

  const sendGif = (gif: GifItem) => {
    // Le débit partagé (six d'affilée, puis un par seconde) : refusé ici, rien ne part — et on le dit.
    if (!chat.sendGif({ url: gif.url, w: gif.w || undefined, h: gif.h || undefined })) {
      onRefused?.();
      return;
    }
    // Un anneau bref sur la vignette : accusé visuel local (l'écho du serveur suit).
    setSentId(gif.id);
    setTimeout(() => setSentId((cur) => (cur === gif.id ? null : cur)), 700);
  };

  // Serveur sans clé GIF (vieille image, développement sans .env) : état explicite.
  if (data && !data.configured) {
    return (
      <p className="wtc-note flex-1">
        <strong>{t("gifNotConfigured")}</strong>
        {t("gifNotConfiguredHint")}
      </p>
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
          maxLength={100}
          placeholder={t("gifSearchPlaceholder")}
          aria-label={t("gifSearchPlaceholder")}
          className="wtc-field wtc-field--small"
        />
      </div>

      <div className="wtc-picker__scroll">
        {isLoading && !data ? (
          <div className="wtc-gif-grid" aria-hidden>
            {Array.from({ length: 6 }, (_, i) => <div key={i} className="wtc-gif-skeleton" />)}
          </div>
        ) : data?.error ? (
          <p className="wtc-note" role="status">{t("gifError")}</p>
        ) : data && data.results.length === 0 ? (
          <p className="wtc-note" role="status">{t("gifNoResults")}</p>
        ) : (
          <div className="wtc-gif-grid">
            {data?.results.map((gif) => (
              <GifCell key={gif.id} gif={gif} sent={sentId === gif.id} onSend={sendGif} sendLabel={t("gifSendAria")} />
            ))}
          </div>
        )}
      </div>

      <p className="wtc-attribution">{t("gifAttribution")}</p>
    </div>
  );
});
