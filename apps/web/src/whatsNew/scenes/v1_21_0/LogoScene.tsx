import { useTranslation } from "react-i18next";
import { TentacleLogo } from "../../../components/ui/TentacleLogo";
import type { SceneProps } from "../../types";
import { FauxChip, Place, SceneStage, useSceneClock } from "..";

const STEPS = [500, 1000, 1200, 1500] as const;

/** Le nouveau logo se pose sur un halo, puis tout ce qui le suit : icône, splash, favicon, rose d'accent. */
export function LogoScene({ active, reduced }: SceneProps) {
  const { t } = useTranslation();
  const { step, cycle } = useSceneClock(STEPS, { active, reduced });
  const logo = step >= 1;
  const chips = step >= 2;
  return (
    <SceneStage cycle={cycle}>
      <Place
        x={170}
        y={20}
        w={300}
        h={300}
        className="rounded-full"
        style={{ background: "radial-gradient(circle, rgba(var(--brand-rgb), 0.35) 0%, rgba(var(--brand-accent-rgb), 0.12) 40%, transparent 68%)" }}
      />
      {/* Variante « bare » : « glow » porte un filter statique, on n'anime pas son transform. */}
      <Place x={0} y={64} w={640} visible={logo} scale={logo ? 1 : 0.8} className="flex justify-center">
        <TentacleLogo size="xl" variant="bare" />
      </Place>
      <Place x={0} y={206} w={640} visible={chips} dy={chips ? 0 : 8} className="flex justify-center">
        <span className="text-[26px] font-extrabold tracking-tight text-content-primary">Tentacle TV</span>
      </Place>
      <FauxChip x={196} y={262} label={t("whatsNew:sceneLogoIcon")} icon="check" visible={chips} dy={chips ? 0 : 8} />
      <FauxChip x={282} y={262} label={t("whatsNew:sceneLogoSplash")} icon="check" visible={chips} dy={chips ? 0 : 8} />
      <FauxChip x={372} y={262} label={t("whatsNew:sceneLogoFavicon")} icon="check" visible={chips} dy={chips ? 0 : 8} />
      <FauxChip x={262} y={304} label={t("whatsNew:sceneLogoAccent")} selected visible={step >= 3} dy={step >= 3 ? 0 : 8} />
    </SceneStage>
  );
}
