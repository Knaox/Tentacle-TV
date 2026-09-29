import { useTranslation } from "react-i18next";
import { AuthAlert } from "../../auth/AuthAlert";
import { AuthButton, AuthTextButton } from "../../auth/AuthButton";
import { LinksGroup } from "./LinksGroup";
import { useLinksDraft } from "./useLinksDraft";

/**
 * Étape 4 de l'installation, FACULTATIVE : le lien public et la lecture
 * directe, avec les explications de la vue d'ensemble — la même source de
 * mots (`serverLinks`) et le même verdict (shared).
 *
 * Elle vient APRÈS le compte administrateur : l'installation est déjà
 * terminée, l'étape enregistre par les routes de l'administration avec le
 * jeton qui vient d'être rendu. Rien n'y bloque : « Passer pour l'instant »
 * ouvre l'application, une adresse que le serveur ne joint pas s'enregistre
 * quand même (certaines box ne laissent pas une machine se joindre par son
 * adresse publique), et tout se retrouve dans Administration › Vue d'ensemble.
 */
export function LinksStep({ token, onDone }: { token: string; onDone: () => void }) {
  const { t } = useTranslation("serverLinks");
  const links = useLinksDraft(token);

  return (
    <div className="space-y-4">
      <LinksGroup id="publicUrl" fields={["publicUrl"]} links={links} />
      <LinksGroup id="directPlay" fields={["jellyfinPublicUrl", "jellyfinPrivateUrl"]} links={links} />

      {links.directHalf && <AuthAlert tone="info">{t("directNeedsBoth")}</AuthAlert>}
      {links.failure && <AuthAlert tone="error">{t("saveError", { message: links.failure })}</AuthAlert>}
      <p className="text-xs leading-relaxed text-content-tertiary">{t("wizardLater")}</p>

      <div className="flex flex-col-reverse gap-3 pt-1 xs:flex-row xs:items-center">
        <AuthTextButton onClick={onDone} disabled={links.busy === "save"}>
          {t("skip")}
        </AuthTextButton>
        <AuthButton
          variant="secondary"
          fullWidth={false}
          onClick={() => void links.check()}
          loading={links.busy === "check"}
          loadingLabel={t("checking")}
          disabled={!links.filled || links.busy !== null}
          className="xs:ml-auto"
        >
          {t("check")}
        </AuthButton>
        <AuthButton
          fullWidth={false}
          onClick={() => void links.save().then((saved) => saved && onDone())}
          loading={links.busy === "save"}
          loadingLabel={t("saving")}
          disabled={!links.filled || links.busy !== null}
        >
          {t("saveAndFinish")}
        </AuthButton>
      </div>
    </div>
  );
}
