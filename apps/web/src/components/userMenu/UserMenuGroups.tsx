import { memo } from "react";
import { useTranslation } from "react-i18next";
import type { UserMenuGroup, UserMenuGroupKey, UserMenuItem } from "./menuItems";

/** Le nom de chaque famille pour les lecteurs d'écran (jamais affiché) ; la déconnexion, seule, n'en a pas. */
export const MENU_GROUP_LABEL_KEYS: Partial<Record<UserMenuGroupKey, string>> = {
  account: "menuGroupAccount",
  device: "menuGroupDevice",
  support: "menuGroupSupport",
};

interface UserMenuGroupsProps {
  groups: readonly UserMenuGroup[];
}

/**
 * Le corps du menu de l'avatar (bureau, web) : les familles de
 * `buildUserMenuGroups`, chacune séparée de la suivante par un filet. Les
 * deux premières (moi, cet appareil) en lignes pleines, pictogramme et
 * libellé ; le PIED réunit sur une seule ligne le secondaire — « Aide »,
 * « À propos », en liens discrets — et, poussée à droite, « Déconnexion » en
 * rouge : la destruction reste à part et en dernier, sans une famille de plus.
 * Toutes les entrées sont des `menuitem` : les flèches les parcourent dans
 * l'ordre de lecture (`useMenuKeyboard`).
 */
export const UserMenuGroups = memo(function UserMenuGroups({ groups }: UserMenuGroupsProps) {
  const { t } = useTranslation("nav");
  const rows = groups.filter((group) => group.key === "account" || group.key === "device");
  const support = groups.find((group) => group.key === "support")?.items ?? [];
  const session = groups.find((group) => group.key === "session")?.items ?? [];
  return (
    <>
      {rows.map((group) => (
        <div
          key={group.key}
          role="group"
          aria-label={labelOf(group.key, t)}
          className="border-b border-line-subtle py-1.5"
        >
          {group.items.map((item) => <MenuRow key={item.key} item={item} />)}
        </div>
      ))}
      {(support.length > 0 || session.length > 0) && (
        <div className="flex items-center gap-1 px-2 py-1.5">
          {support.length > 0 && (
            <div role="group" aria-label={labelOf("support", t)} className="flex min-w-0 items-center gap-0.5">
              {support.map((item) => <FooterLink key={item.key} item={item} />)}
            </div>
          )}
          {session.map((item) => <FooterDanger key={item.key} item={item} />)}
        </div>
      )}
    </>
  );
});

function labelOf(key: UserMenuGroupKey, t: (key: string) => string): string | undefined {
  const labelKey = MENU_GROUP_LABEL_KEYS[key];
  return labelKey ? t(labelKey) : undefined;
}

/** Une entrée pleine : pictogramme et libellé. */
export function MenuRow({ item }: { item: UserMenuItem }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={item.action}
      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-content-secondary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:bg-fill-subtle focus-visible:text-content-primary focus-visible:outline-none"
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {item.label}
    </button>
  );
}

/** Un lien du pied (« Aide », « À propos ») : du texte seul, plus discret qu'une entrée. */
function FooterLink({ item }: { item: UserMenuItem }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={item.action}
      className="whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] text-content-tertiary transition-colors duration-150 hover:bg-fill-subtle hover:text-content-primary focus-visible:bg-fill-subtle focus-visible:text-content-primary focus-visible:outline-none"
    >
      {item.label}
    </button>
  );
}

/** « Déconnexion », au bout du pied, en rouge. */
function FooterDanger({ item }: { item: UserMenuItem }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={item.action}
      className="ml-auto flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-1.5 text-[13px] font-medium text-[color:var(--status-error-fg)] transition-colors duration-150 hover:bg-[color:var(--status-error-bg)] focus-visible:bg-[color:var(--status-error-bg)] focus-visible:outline-none"
    >
      <span className="flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4">{item.icon}</span>
      {item.label}
    </button>
  );
}
