import { memo } from "react";
import { useTranslation } from "react-i18next";
import { CURRENT_STACKS, stackDownloadCommand, type CurrentStack } from "@tentacle-tv/shared";
import { CopyBlock } from "../../remoteAccess/CopyBlock";
import { GuideSteps, GuideTitle } from "./GuideSteps";

/**
 * Une pile officielle d'avant 1.25 (service `db`, `init`, secrets) : deux voies,
 * au choix. La plus simple, passer à la pile d'aujourd'hui qui la remplace — le
 * serveur dit laquelle (`newStack`) ; sans elle, les deux —, ou retirer les
 * lignes soi-même. Puis ce qui vaut pour les deux : les volumes, plus tard, et
 * l'erreur de Compose d'un `depends_on` oublié.
 */
export const OfficialStackGuide = memo(function OfficialStackGuide({ newStack, service }: { newStack: CurrentStack | null; service: string }) {
  const { t } = useTranslation("adminDatabaseMigration");
  const stacks = newStack ? [newStack] : CURRENT_STACKS;
  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <GuideTitle>{t("switchTitle")}</GuideTitle>
        <p className="text-sm leading-relaxed text-content-secondary">
          {newStack ? t("switchIntro", { stack: newStack }) : t("switchIntroBoth")}
        </p>
        {stacks.map((stack) => (
          <CopyBlock key={stack} label={stack} code={stackDownloadCommand(stack)} />
        ))}
        <GuideSteps text={t("guide_officialStack_switch", { service })} />
      </section>
      <section className="space-y-2">
        <GuideTitle>{t("linesTitle")}</GuideTitle>
        <GuideSteps text={t("guide_officialStack", { service })} />
      </section>
      <section className="space-y-2">
        <GuideTitle>{t("afterTitle")}</GuideTitle>
        <GuideSteps text={t("guide_officialStack_after", { service })} />
      </section>
    </div>
  );
});
