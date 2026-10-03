import { Fragment, createElement, type ReactNode } from "react";

/** Une doublure de react-native-svg : des vues qui ne dessinent rien. */

type Props = { children?: ReactNode };
const shape = (props: Props) => createElement(Fragment, null, props.children);

export default shape;
export const Svg = shape;
export const Path = shape;
export const Rect = shape;
export const Circle = shape;
export const G = shape;
export const Defs = shape;
export const ClipPath = shape;
export const LinearGradient = shape;
export const RadialGradient = shape;
export const Stop = shape;
export const Line = shape;
export const Polyline = shape;
export const Polygon = shape;
export const Ellipse = shape;
export const Mask = shape;
export const FeColorMatrix = shape;
export const Filter = shape;
export const Image = shape;
