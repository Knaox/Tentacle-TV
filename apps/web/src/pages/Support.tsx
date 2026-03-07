import { SupportPanel } from "../components/SupportPanel";
import { PageTransition } from "../components/PageTransition";

export function Support() {
  return (
    <PageTransition>
      <div className="pt-16">
        <SupportPanel />
      </div>
    </PageTransition>
  );
}
