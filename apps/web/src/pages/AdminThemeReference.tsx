import { Navigate, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { PageTransition } from "../components/PageTransition";
import { getUserInfo } from "../components/userMenu/menuItems";
import { CodeBlock } from "../components/admin/theme/reference/CodeBlock";
import {
  ALL_IN_ONE_REFERENCE,
  CHRISTMAS_REFERENCE,
  EASTER_REFERENCE,
  HALLOWEEN_REFERENCE,
} from "../components/admin/theme/reference/themeReferenceData";

/**
 * Reference page. One giant code block that contains everything an AI (or a
 * human) needs to author a Tentacle TV theme — variables, selectors,
 * keyframes, utility mapping, and a prompt template. Three working preset
 * CSS strings are listed below as inspiration.
 */
export function AdminThemeReference() {
  const { t } = useTranslation("adminTheme");
  const navigate = useNavigate();
  const { isAdmin } = getUserInfo();

  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <PageTransition>
      <div className="px-4 pt-6 pb-16 md:px-12">
        <div className="mx-auto max-w-5xl">
          <button
            type="button"
            onClick={() => navigate("/admin/theme")}
            className="mb-3 inline-flex items-center gap-1 text-xs font-medium text-white/55 transition hover:text-white"
          >
            ← {t("tokensBackToTheme")}
          </button>
          <h1 className="mb-3 text-3xl font-extrabold tracking-tight text-white">
            {t("refPageTitle")}
          </h1>
          <p className="mb-8 text-sm text-white/55">{t("refPageHelp")}</p>

          {/* The killer block — everything in one copy */}
          <div className="mb-8 rounded-2xl border border-[var(--brand)]/35 bg-[var(--brand-soft)] p-6">
            <h2 className="mb-2 text-xl font-bold text-white">
              {t("refAllInOneTitle")}
            </h2>
            <p className="mb-4 text-sm text-white/75">{t("refAllInOneHelp")}</p>
            <CodeBlock
              title={t("refAllInOneBlockTitle")}
              description={t("refAllInOneBlockDesc")}
              code={ALL_IN_ONE_REFERENCE}
              language="text"
            />
          </div>

          {/* Working presets as inspiration */}
          <h2 className="mb-3 text-xl font-semibold text-white">
            {t("refExamplesTitle")}
          </h2>
          <p className="mb-6 text-sm text-white/55">{t("refExamplesHelp")}</p>

          <CodeBlock
            title={t("refExampleXmasTitle")}
            code={CHRISTMAS_REFERENCE}
            language="css"
          />
          <CodeBlock
            title={t("refExampleEasterTitle")}
            code={EASTER_REFERENCE}
            language="css"
          />
          <CodeBlock
            title={t("refExampleHalloweenTitle")}
            code={HALLOWEEN_REFERENCE}
            language="css"
          />
        </div>
      </div>
    </PageTransition>
  );
}
