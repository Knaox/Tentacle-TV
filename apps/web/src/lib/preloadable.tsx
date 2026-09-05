import { use } from "react";
import type { ComponentType, FunctionComponent } from "react";

export interface PreloadableComponent<P> extends FunctionComponent<P> {
  /** Charge le module (survol du lien, boot) ; idempotent, échec retentable. */
  preload: () => Promise<void>;
}

/**
 * Un composant chargé à la demande qui, une fois son module là, rend de façon
 * SYNCHRONE — là où `React.lazy` suspend toujours une fois, même module en
 * cache : le spinner clignotait une à trois images. Préchargé, la page se
 * rend sans aucun fondu de chargement. Un échec réinitialise la promesse, la
 * tentative suivante repart (même filet que le préchargement des fiches).
 */
export function preloadable<P extends object>(
  loader: () => Promise<ComponentType<P>>
): PreloadableComponent<P> {
  let loaded: ComponentType<P> | null = null;
  let pending: Promise<ComponentType<P>> | null = null;

  const load = (): Promise<ComponentType<P>> => {
    if (loaded) return Promise.resolve(loaded);
    if (!pending) {
      pending = loader().then(
        (component) => {
          loaded = component;
          return component;
        },
        (err: unknown) => {
          pending = null;
          throw err;
        }
      );
    }
    return pending;
  };

  const Preloadable = ((props: P) => {
    // `use` suspend tant que le module n'est pas là — jamais quand il l'est.
    const Component = loaded ?? use(load());
    return <Component {...props} />;
  }) as PreloadableComponent<P>;
  Preloadable.preload = () => load().then(() => undefined);
  return Preloadable;
}
