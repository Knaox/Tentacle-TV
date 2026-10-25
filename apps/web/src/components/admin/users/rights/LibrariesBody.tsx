import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toggleInList } from "../../../parental/parentalModel";
import { CheckList, RightError, ToggleRight } from "./RightRows";
import type { GroupProps } from "./GroupBodies";

/** Les types de bibliothèques que la fiche nomme (`libraries.types`) — la musique s'y reconnaît. */
const NAMED_TYPES = new Set(["movies", "tvshows", "music", "musicvideos", "books", "homevideos", "boxsets", "photos", "mixed"]);

/** Les entrées d'une liste par nom ; un identifiant permis que Jellyfin ne connaît plus reste décochable. */
function withMissing(items: readonly { id: string; name: string; detail?: string }[], value: readonly string[], missing: string) {
  const known = new Set(items.map((item) => item.id));
  return [...items, ...value.filter((id) => !known.has(id)).map((id) => ({ id, name: missing }))];
}

/**
 * Les bibliothèques, par NOM et par type (« Musique » : celles qu'Octave lit) :
 * « Toutes », ou une case par bibliothèque.
 * Couper « Toutes » sans rien cocher laisse le compte sans bibliothèque —
 * c'est un choix, la liste le montre vide. (Les chaînes de Jellyfin ne se
 * règlent pas ici : Tentacle n'en affiche aucune.)
 */
export function LibrariesBody({ rights, options, writer }: GroupProps) {
  const { t } = useTranslation("userRights");
  const missing = t("libraries.unknown");
  const libraries = useMemo(
    () => withMissing(
      (options?.libraries ?? []).map((library) => {
        const type = (library.collectionType ?? "").toLowerCase();
        const detail = NAMED_TYPES.has(type) ? t(`libraries.types.${type}`) : undefined;
        // « Musique · Musique » ne dit rien de plus : le type ne se répète pas quand il EST le nom.
        return { id: library.id, name: library.name, detail: detail?.toLowerCase() === library.name.trim().toLowerCase() ? undefined : detail };
      }),
      rights.enabledFolders,
      missing,
    ),
    [options, rights.enabledFolders, missing, t],
  );

  return (
    <>
      <ToggleRight field="enableAllFolders" checked={rights.enableAllFolders} writer={writer} />
      {!rights.enableAllFolders && (
        <div>
          <CheckList
            title={t("fields.enabledFolders.label")}
            hint={t("fields.enabledFolders.hint")}
            items={libraries}
            value={rights.enabledFolders}
            disabled={writer.isPending("enabledFolders")}
            empty={t("libraries.none")}
            onToggle={(id, on) => writer.write({ enabledFolders: toggleInList(rights.enabledFolders, id, on) })}
          />
          <RightError text={writer.errorFor("enabledFolders")} />
        </div>
      )}
    </>
  );
}
