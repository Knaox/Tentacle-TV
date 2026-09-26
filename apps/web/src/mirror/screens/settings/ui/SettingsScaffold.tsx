import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft } from "lucide-react";
import { SCREEN_PADDING } from "../../../responsive";
import { useContentPadding } from "../../../useMirrorLayout";

/**
 * `SettingsScaffold` de l'app (`screens/settings/SettingsScaffold.tsx`) : un
 * écran empilé, sans en-tête de verre ni barre d'onglets — bouton retour
 * rond de 36, titre 22 extra-gras, puis le contenu dans une colonne centrée
 * (`useContentPadding(720)`). Haut : `max(zone sûre, 24) + 8` ; bas : zone
 * sûre + 24. À monter HORS de `MirrorLayout`, comme un écran de pile.
 */
export function SettingsScaffold({ title, children, maxWidth = 720 }: {
  title: string;
  children: ReactNode;
  /** Largeur de colonne centrée sur grand écran (défaut 720 ; mot de passe 560). */
  maxWidth?: number;
}) {
  const { t } = useTranslation("common");
  const navigate = useNavigate();
  const padding = useContentPadding(maxWidth);

  const back = () => {
    // `backOrHome` de l'app : retour s'il y a un historique, sinon le profil.
    if (window.history.state && typeof window.history.state.idx === "number" && window.history.state.idx > 0) navigate(-1);
    else navigate("/profile", { replace: true });
  };

  return (
    <div
      className="min-h-screen bg-surface-0"
      style={{
        paddingTop: "calc(max(env(safe-area-inset-top, 0px), 24px) + 8px)",
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 24px)",
      }}
    >
      <header className="mb-4 flex items-center gap-3" style={{ paddingInline: SCREEN_PADDING }}>
        <button
          type="button"
          onClick={back}
          aria-label={t("back")}
          className="mirror-press flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-line-subtle bg-fill-soft text-content-primary"
          style={{ WebkitTapHighlightColor: "transparent" }}
        >
          <ArrowLeft size={18} aria-hidden />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-[-0.4px] text-content-primary">{title}</h1>
      </header>
      <div style={{ paddingInline: padding }}>{children}</div>
    </div>
  );
}
