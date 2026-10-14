/**
 * Le lecteur OFFICIEL de YouTube, dans son cadre — extrait de la modale des
 * bandes-annonces (`TrailerModal`), qui le rend toujours, et repris par le
 * lecteur complet comme REPLI : quand le serveur ne peut pas extraire la vidéo
 * (`409 { fallback: "embed" }`) ou que la lecture relayée échoue — le lecteur
 * dit alors, au-dessus, que des publicités peuvent y paraître.
 *
 * `youtube-nocookie.com`, et sur le bureau la page relais `/yt-embed.html`
 * du serveur (`youtubeEmbedSrc`) : l'origine `tentacle://app` ne donne pas
 * de referrer à YouTube (erreur 153).
 */

import { youtubeEmbedSrc } from "./youtube";

interface Props {
  ytId: string;
  title: string;
  className?: string;
}

export function TrailerEmbedFallback({ ytId, title, className = "" }: Props) {
  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <iframe
        key={ytId}
        src={youtubeEmbedSrc(ytId)}
        title={title}
        className="absolute inset-0 h-full w-full"
        // YouTube refuse l'embed sans Referer (erreur 153). En prod le header
        // Referrer-Policy: no-referrer (Helmet) le supprime → on force l'envoi
        // de l'origine pour CETTE iframe (l'attribut prime sur la politique doc).
        referrerPolicy="strict-origin-when-cross-origin"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
