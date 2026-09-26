import { memo, type ReactElement, type ReactNode } from "react";
import { RowHeader } from "./RowHeader";

/**
 * La rangée horizontale de l'app (`MediaRow`) : 24 au-dessus, en-tête, puis
 * les cartes à 14 d'écart, marges de 16, défilement libre sans barre.
 */
export const MediaRow = memo(function MediaRow<T>({ title, data, renderItem, keyOf, onSeeAll, accessory }: {
  title: string;
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyOf: (item: T, index: number) => string;
  onSeeAll?: () => void;
  accessory?: ReactNode;
}) {
  if (data.length === 0) return null;
  return (
    <section className="mt-6">
      <RowHeader title={title} onSeeAll={onSeeAll} accessory={accessory} />
      <div className="mirror-no-scrollbar flex gap-3.5 overflow-x-auto overscroll-x-contain px-4" style={{ scrollPaddingInline: 16 }}>
        {data.map((item, i) => (
          <div key={keyOf(item, i)} className="shrink-0">
            {renderItem(item, i)}
          </div>
        ))}
      </div>
    </section>
  );
}) as <T>(props: {
  title: string;
  data: T[];
  renderItem: (item: T, index: number) => ReactNode;
  keyOf: (item: T, index: number) => string;
  onSeeAll?: () => void;
  accessory?: ReactNode;
}) => ReactElement | null;
