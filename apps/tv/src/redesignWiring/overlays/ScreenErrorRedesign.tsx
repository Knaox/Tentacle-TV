import { useCallback, useEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { FocusBindingProvider } from "../../redesign/focus/focusBinding";
import { ScreenErrorView } from "../../redesign/screens/overlays/ScreenErrorView";
import { routeRailKey, type RouteLike } from "../../navigation/routeRailKey";
import { REDESIGN_ROUTES } from "../redesignGate";
import { useFocusStore } from "../focus/focusStore";
import { RedesignScreen } from "../screen/RedesignScreen";
import { useRedesignScreen } from "../screen/useRedesignScreen";

/**
 * Ce que la frontière d'erreur montre à la place d'un écran tombé (Apple TV) :
 * `ScreenErrorView` — la pieuvre triste, des textes traduits (fini l'anglais
 * en dur), Réessayer (l'écran est remonté), Retour quand la pile peut
 * reculer, et le détail technique en petit.
 *
 * Trois cadres, selon où la frontière est posée :
 * - un écran refondu AVEC navigation : la navigation survit à l'écran fautif
 *   (`useRedesignScreen`, sa route donne l'entrée active) ;
 * - un autre écran (fiche, lecteur…) : Retour recule d'un écran ;
 * - la racine de l'app, hors de toute navigation : Réessayer seulement.
 * Le focus entre sur Réessayer.
 */

const ENTRY = "screenError:retry";

interface Props {
  error: Error | null;
  /** La route de l'écran enveloppé ; absente à la racine de l'app. */
  route?: RouteLike;
  onRetry: () => void;
}

const detailOf = (error: Error | null) => (error ? `${error.name}: ${error.message}` : undefined);

export function ScreenErrorRedesign({ error, route, onRetry }: Props) {
  if (!route) return <DetachedError error={error} onRetry={onRetry} />;
  const railKey = REDESIGN_ROUTES.has(route.name) ? routeRailKey(route) : null;
  if (railKey) return <RailScreenError error={error} railKey={railKey} onRetry={onRetry} />;
  return <PlainScreenError error={error} onRetry={onRetry} />;
}

function DetachedError({ error, onRetry }: Omit<Props, "route">) {
  const store = useFocusStore();
  useEffect(() => store.claim(ENTRY), [store]);
  return (
    <FocusBindingProvider bind={store.binder}>
      <ScreenErrorView detail={detailOf(error)} canGoBack={false} onRetry={onRetry} />
    </FocusBindingProvider>
  );
}

function PlainScreenError({ error, onRetry }: Omit<Props, "route">) {
  const navigation = useNavigation();
  const store = useFocusStore();
  useEffect(() => store.claim(ENTRY), [store]);
  const back = useCallback(() => navigation.goBack(), [navigation]);
  return (
    <FocusBindingProvider bind={store.binder}>
      <ScreenErrorView detail={detailOf(error)} canGoBack={navigation.canGoBack()} onRetry={onRetry} onBack={back} />
    </FocusBindingProvider>
  );
}

function RailScreenError({ error, railKey, onRetry }: Omit<Props, "route"> & { railKey: string }) {
  const navigation = useNavigation();
  const screen = useRedesignScreen({ railKey, entryKey: ENTRY });
  const back = useCallback(() => navigation.goBack(), [navigation]);
  return (
    <RedesignScreen screen={screen}>
      <ScreenErrorView nav={screen.nav} detail={detailOf(error)} canGoBack={navigation.canGoBack()} onRetry={onRetry} onBack={back} />
    </RedesignScreen>
  );
}
