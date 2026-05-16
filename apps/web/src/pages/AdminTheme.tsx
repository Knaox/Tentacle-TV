import { useQuery } from "@tanstack/react-query";
import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { ThemeNameSection } from "../components/admin/theme/ThemeNameSection";
import { ThemeBrandColorSection } from "../components/admin/theme/ThemeBrandColorSection";
import { ThemeAccentColorSection } from "../components/admin/theme/ThemeAccentColorSection";
import { ThemeCustomCssSection } from "../components/admin/theme/ThemeCustomCssSection";
import { ThemePresetSection } from "../components/admin/theme/ThemePresetSection";
import { ThemeResetSection } from "../components/admin/theme/ThemeResetSection";
import { cls } from "./adminUtils";
import { getUserInfo } from "../components/userMenu/menuItems";
import { fetchThemeState } from "../theme";
import { backendUrl } from "../main";

/**
 * Admin theme page. Mounted at `/admin/theme`. Requires admin Jellyfin user
 * (enforced both here and server-side via `requireAdmin` middleware).
 */
export function AdminTheme() {
  const { t } = useTranslation("adminTheme");
  const navigate = useNavigate();
  const { isAdmin } = getUserInfo();

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["theme", backendUrl],
    queryFn: () => fetchThemeState(backendUrl),
    enabled: isAdmin,
  });

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-4xl">
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">
            {t("title")}
          </h1>
          <p className="mb-8 text-sm text-white/55">{t("description")}</p>

          {isLoading && (
            <div className={cls.card}>
              <p className="text-sm text-white/55">{t("saving")}</p>
            </div>
          )}

          {isError && (
            <div className={cls.card}>
              <p className="text-sm text-[var(--status-error-fg)]">
                {t("errorPrefix")}:{" "}
                {error instanceof Error ? error.message : String(error)}
              </p>
            </div>
          )}

          {data && (
            <>
              <ThemePresetSection />

              <div className={cls.card}>
                <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {t("tokensCardTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-white/40">
                      {t("tokensCardDescription")}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/admin/theme/tokens")}
                    className={`${cls.bbrand} self-start xs:self-auto`}
                  >
                    {t("tokensCardButton")}
                  </button>
                </div>
              </div>

              <div className={cls.card}>
                <div className="flex flex-col gap-3 xs:flex-row xs:items-center xs:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {t("refCardTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-white/40">
                      {t("refCardDescription")}
                    </p>
                  </div>
                  <button
                    onClick={() => navigate("/admin/theme/reference")}
                    className={`${cls.bbrand} self-start xs:self-auto`}
                  >
                    {t("refCardButton")}
                  </button>
                </div>
              </div>

              <div className={cls.card}>
                <h2 className="mb-4 text-lg font-semibold text-white">
                  {t("currentTheme")}
                </h2>
                <div className="space-y-4">
                  <ThemeNameSection state={data} />
                  <ThemeBrandColorSection state={data} />
                  <ThemeAccentColorSection state={data} />
                  <ThemeResetSection />
                </div>
              </div>

              <ThemeCustomCssSection state={data} />
            </>
          )}
        </div>
      </div>
    </PageTransition>
  );
}
