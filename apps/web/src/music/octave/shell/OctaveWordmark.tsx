import { useTranslation } from "react-i18next";
import { OctaveLogo } from "../components/OctaveLogo";

/**
 * La marque du mode : le logo (la mascotte de Tentacle et son tricorne), le nom
 * écrit au dégradé, et la SIGNATURE dessous — « Tentacle » : on sait qu'on est
 * dans le mode musique de Tentacle, pas dans une autre application. Lue d'un
 * bloc : « Octave, le mode musique de Tentacle ».
 */
export function OctaveWordmark({ className = "", logoSize = 32 }: { className?: string; logoSize?: number }) {
  const { t } = useTranslation("octaveShell");
  return (
    <span role="img" aria-label={t("signature.label")} className="flex min-w-0 items-center gap-2" data-octave-wordmark>
      <OctaveLogo size={logoSize} />
      <span aria-hidden className="flex min-w-0 flex-col">
        <span className={`oc-gradient-text truncate text-[22px] font-black leading-none tracking-tight ${className}`}>Octave</span>
        <span className="mt-1 truncate text-[10px] font-bold uppercase leading-none tracking-[0.18em] text-content-tertiary">
          {t("signature.of")}
        </span>
      </span>
    </span>
  );
}
