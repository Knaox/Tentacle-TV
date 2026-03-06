import { createContext, useContext } from "react";
import { Animated } from "react-native";

const HeaderScrollCtx = createContext<Animated.Value>(new Animated.Value(0));

export const HeaderScrollProvider = HeaderScrollCtx.Provider;

export function useHomeScrollY(): Animated.Value {
  return useContext(HeaderScrollCtx);
}
