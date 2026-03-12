import { useCallback, type RefObject } from "react";
import { type ScrollView, type View } from "react-native";

/**
 * Returns an `onFocus` handler factory for items inside a ScrollView.
 * When an item receives focus, the ScrollView scrolls to make it visible.
 *
 * Usage:
 * ```tsx
 * const scrollRef = useRef<ScrollView>(null);
 * const makeOnFocus = useTVScrollToFocused(scrollRef);
 * // ...
 * <Focusable onFocus={makeOnFocus(index, ITEM_HEIGHT)} ... />
 * ```
 */
export function useTVScrollToFocused(
  scrollRef: RefObject<ScrollView | null>,
  /** Extra offset above the item when scrolling (default: 80) */
  topOffset = 80,
) {
  /**
   * Returns a callback to pass as `onFocus`.
   * @param index  Item index in the list
   * @param itemHeight  Height of each item (including gap/margin)
   */
  const makeOnFocus = useCallback(
    (index: number, itemHeight: number) => () => {
      const y = index * itemHeight;
      scrollRef.current?.scrollTo({ y: Math.max(0, y - topOffset), animated: true });
    },
    [scrollRef, topOffset],
  );

  /**
   * Alternative: scroll by measuring the native view.
   * Pass a ref to the child View — it will be measured relative to the ScrollView.
   */
  const scrollToView = useCallback(
    (viewRef: RefObject<View | null>) => () => {
      viewRef.current?.measureLayout(
        scrollRef.current as unknown as View,
        (_left, top) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, top - topOffset), animated: true });
        },
        () => { /* measurement failed — ignore */ },
      );
    },
    [scrollRef, topOffset],
  );

  return { makeOnFocus, scrollToView };
}
