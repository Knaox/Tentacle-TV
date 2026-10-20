import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { BOOT_INK, bootIntroGate } from "@tentacle-tv/brand-intro-native";
import { BootIntroHost } from "./BootIntroHost";
import { bootDecision } from "./bootPlan";
import type { MobileBootPlan } from "./bootIntroRules";

/**
 * L'enveloppe de l'app : l'ouverture du démarrage, ou l'app telle quelle.
 * Tant que la décision n'est pas prise (quelques millisecondes : le réglage
 * d'accessibilité, deux clés du disque), l'encre seule — celle de l'écran de
 * lancement —, l'app n'est pas encore montée : elle ne change jamais d'arbre.
 */
export function BootIntroShell({ screenColor, children }: { screenColor: string; children: ReactNode }) {
  const [plan, setPlan] = useState<MobileBootPlan | null>(null);
  useEffect(() => {
    let alive = true;
    void bootDecision().then((next) => {
      // Dit avant le premier rendu de l'app : ce qui s'ouvre par-dessus au lancement attend l'arrivée.
      if (next.plan === "intro") bootIntroGate.reportPlaying(true);
      if (alive) setPlan(next);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (plan === null) return <View style={styles.ink} />;
  if (plan.plan === "boot") return <>{children}</>;
  return (
    <BootIntroHost sound={plan.sound} screenColor={screenColor}>
      {children}
    </BootIntroHost>
  );
}

const styles = StyleSheet.create({
  ink: { flex: 1, backgroundColor: BOOT_INK },
});
