import Svg, { Circle, Path } from "react-native-svg";

interface TentacleLogoProps {
  size?: number;
}

/** Real Tentacle octopus logo from the project SVG assets */
export function TentacleLogo({ size = 48 }: TentacleLogoProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <Circle cx={16} cy={16} r={15} fill="#1a1a2e" />
      <Path
        d="M16 6c-1.5 0-2.7 1.2-2.7 2.7 0 .8.3 1.5.8 2l-3.2 5.5c-.6-.3-1.2-.4-1.9-.4-2.5 0-4.5 2-4.5 4.5S6.5 24.8 9 24.8s4.5-2 4.5-4.5c0-.7-.2-1.4-.5-2l3.1-5.3c.3.1.6.1.9.1s.6 0 .9-.1l3.1 5.3c-.3.6-.5 1.3-.5 2 0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5-2-4.5-4.5-4.5c-.7 0-1.3.1-1.9.4L19.9 10.7c.5-.5.8-1.2.8-2C20.7 7.2 19.5 6 18 6h-2z"
        fill="#7c3aed"
      />
      <Circle cx={9} cy={20.3} r={2.5} fill="#8b5cf6" />
      <Circle cx={23} cy={20.3} r={2.5} fill="#8b5cf6" />
      <Circle cx={16} cy={8.7} r={1.7} fill="#a78bfa" />
    </Svg>
  );
}
