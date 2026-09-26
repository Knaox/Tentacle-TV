import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft } from "lucide-react";
import { useJellyfinClient } from "@tentacle-tv/api-client";
import type { MediaItem } from "@tentacle-tv/shared";
import { LoadingBar } from "../../../components/player/PlayerLoadingScreen";
import { useViewport } from "../../useFormFactor";
import { PLAYER } from "../playerColors";
import { loadingArt } from "./loadingArt";

interface Props {
  item?: MediaItem | null;
  /** Quitter sans attendre le démarrage — toujours offert pendant l'ouverture. */
  onCancel?: () => void;
  /** Vrai pendant le fondu de sortie (280 ms), quand l'image arrive. */
  leaving?: boolean;
}

/**
 * L'écran de chargement du lecteur de l'app (`PlayerLoadingScreen`) : le fond
 * du titre (l'AFFICHE en portrait, calée en haut sur 116 % de hauteur ; le
 * fond paysage sinon), une lueur de marque en haut à gauche, un voile qui
 * noircit vers le bas ; le logo (220 × 72, 340 × 110 sur tablette) ou le titre
 * 26 / 36, l'épisode 15 px, la barre de chargement (520 au plus) ; la pilule
 * « Retour » en haut à gauche. Couleurs du lecteur : sombre quel que soit le thème.
 */
export function MirrorPlayerLoadingScreen({ item, onCancel, leaving = false }: Props) {
  const { t } = useTranslation("player");
  const client = useJellyfinClient();
  const { formFactor, landscape } = useViewport();
  const isTablet = formFactor === "tablet";
  const art = useMemo(() => loadingArt(client, item), [client, item]);
  const [logoReady, setLogoReady] = useState(false);
  const label = art.title ? t("loadingMedia", { title: art.title }) : t("loading");
  const usePoster = !landscape && art.posterUrl !== null;
  const background = usePoster ? art.posterUrl : (art.backdropUrl ?? art.posterUrl);
  const side = isTablet ? 48 : 24;

  return (
    <div
      className="pointer-events-auto fixed inset-0 overflow-hidden transition-opacity ease-out motion-reduce:transition-none"
      style={{ zIndex: 30, backgroundColor: "#0a0a12", opacity: leaving ? 0 : 1, transitionDuration: "280ms" }}
      onClick={(e) => e.stopPropagation()}
    >
      {background && (
        <img
          key={background}
          src={background}
          alt=""
          aria-hidden
          className="absolute inset-x-0 top-0 w-full object-cover animate-[fadeIn_500ms_ease-out] motion-reduce:animate-none"
          style={usePoster ? { height: "116%", objectPosition: "top" } : { height: "100%", objectPosition: "center" }}
        />
      )}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(var(--brand-rgb), 0.2) 0%, transparent 55%)" }} />
      <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.72) 50%, #000 86%)" }} />

      <div
        role="progressbar"
        aria-label={label}
        className="absolute inset-x-0 bottom-0 flex flex-col"
        style={{
          gap: 6,
          paddingBottom: `calc(max(env(safe-area-inset-bottom, 0px), 16px) + ${isTablet ? 48 : 32}px)`,
          paddingLeft: `max(env(safe-area-inset-left, 0px), ${side}px)`,
          paddingRight: `max(env(safe-area-inset-right, 0px), ${side}px)`,
        }}
      >
        {art.logoUrl && (
          <img
            src={art.logoUrl}
            alt=""
            onLoad={() => setLogoReady(true)}
            className="object-contain object-left"
            style={{
              width: isTablet ? 340 : 220, height: isTablet ? 110 : 72, marginBottom: isTablet ? 6 : 4,
              ...(logoReady ? {} : { position: "absolute", opacity: 0 }),
            }}
          />
        )}
        {!logoReady && art.title !== "" && (
          <p
            className="line-clamp-2"
            style={{ color: PLAYER.text, fontSize: isTablet ? 36 : 26, lineHeight: `${isTablet ? 42 : 31}px`, fontWeight: 700, letterSpacing: -0.4 }}
          >
            {art.title}
          </p>
        )}
        {art.subtitle && <p className="truncate" style={{ color: "rgba(255, 255, 255, 0.55)", fontSize: 15, fontWeight: 500 }}>{art.subtitle}</p>}
        <div style={{ marginTop: 14, maxWidth: 520 }}>
          <LoadingBar />
        </div>
      </div>

      {onCancel && (
        <button
          type="button"
          aria-label={t("back")}
          onClick={onCancel}
          className="absolute flex flex-row items-center rounded-full bg-black/45 active:bg-black/70 [-webkit-tap-highlight-color:transparent]"
          style={{
            top: "calc(max(env(safe-area-inset-top, 0px), 12px) + 8px)",
            left: "max(env(safe-area-inset-left, 0px), 16px)",
            gap: 4, minHeight: 44, paddingLeft: 12, paddingRight: 18,
            border: "1px solid rgba(255, 255, 255, 0.2)",
          }}
        >
          <ChevronLeft size={20} color={PLAYER.text} />
          <span style={{ color: "rgba(255, 255, 255, 0.9)", fontSize: 14, fontWeight: 600 }}>{t("back")}</span>
        </button>
      )}
    </div>
  );
}
