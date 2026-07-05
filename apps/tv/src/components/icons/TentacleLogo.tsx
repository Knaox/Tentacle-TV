import Svg, {
  Defs, LinearGradient, Stop,
  Ellipse, Circle, Path, Line,
} from "react-native-svg";

interface TentacleLogoProps {
  size?: number;
}

/**
 * Pirate octopus logo — faithful conversion of tentacle-logo-pirate.svg
 * ViewBox 0 0 512 560
 */
export function TentacleLogo({ size = 48 }: TentacleLogoProps) {
  return (
    <Svg width={size} height={size * (560 / 512)} viewBox="0 0 512 560" fill="none">
      <Defs>
        <LinearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#8B5CF6" />
          <Stop offset="50%" stopColor="#A855F7" />
          <Stop offset="100%" stopColor="#EC4899" />
        </LinearGradient>
        <LinearGradient id="tg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#7C3AED" />
          <Stop offset="100%" stopColor="#DB2777" />
        </LinearGradient>
        <LinearGradient id="tg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#9333EA" />
          <Stop offset="100%" stopColor="#F472B6" />
        </LinearGradient>
        <LinearGradient id="cheek" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#F9A8D4" />
          <Stop offset="100%" stopColor="#F472B6" />
        </LinearGradient>
        <LinearGradient id="shine" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="white" stopOpacity={0.35} />
          <Stop offset="100%" stopColor="white" stopOpacity={0} />
        </LinearGradient>
        <LinearGradient id="hatG" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#2D2D2D" />
          <Stop offset="100%" stopColor="#1A1A1A" />
        </LinearGradient>
        <LinearGradient id="band" x1="0%" y1="0%" x2="100%" y2="0%">
          <Stop offset="0%" stopColor="#8B5CF6" />
          <Stop offset="50%" stopColor="#A855F7" />
          <Stop offset="100%" stopColor="#EC4899" />
        </LinearGradient>
        <LinearGradient id="skull" x1="0%" y1="0%" x2="0%" y2="100%">
          <Stop offset="0%" stopColor="#FFFFFF" />
          <Stop offset="100%" stopColor="#E2E8F0" />
        </LinearGradient>
      </Defs>

      {/* === TENTACLES === */}
      {/* Back */}
      <Path d="M160 358 Q120 418 100 468 Q85 508 110 528 Q130 543 145 518 Q160 493 155 448 Q152 418 170 388" fill="url(#tg1)" opacity={0.85} />
      <Path d="M352 358 Q392 418 412 468 Q427 508 402 528 Q382 543 367 518 Q352 493 357 448 Q360 418 342 388" fill="url(#tg1)" opacity={0.85} />
      {/* Far */}
      <Path d="M140 348 Q90 388 60 448 Q40 498 65 523 Q88 546 100 508 Q115 468 120 428 Q125 398 150 368" fill="url(#tg2)" opacity={0.8} />
      <Path d="M372 348 Q422 388 452 448 Q472 498 447 523 Q424 546 412 508 Q397 468 392 428 Q387 398 362 368" fill="url(#tg2)" opacity={0.8} />
      {/* Front */}
      <Path d="M185 363 Q165 428 150 478 Q138 518 160 536 Q180 550 188 520 Q195 490 195 448 Q195 413 200 383" fill="url(#tg1)" />
      <Path d="M327 363 Q347 428 362 478 Q374 518 352 536 Q332 550 324 520 Q317 490 317 448 Q317 413 312 383" fill="url(#tg1)" />
      <Path d="M220 373 Q210 438 205 488 Q200 523 220 538 Q240 548 242 516 Q244 484 240 448 Q237 418 235 388" fill="url(#tg2)" />
      <Path d="M292 373 Q302 438 307 488 Q312 523 292 538 Q272 548 270 516 Q268 484 272 448 Q275 418 277 388" fill="url(#tg2)" />
      {/* Suction cups */}
      <Circle cx={108} cy={498} r={5} fill="#DDD6FE" opacity={0.5} />
      <Circle cx={150} cy={506} r={5} fill="#DDD6FE" opacity={0.5} />
      <Circle cx={215} cy={510} r={4} fill="#DDD6FE" opacity={0.5} />
      <Circle cx={297} cy={510} r={4} fill="#DDD6FE" opacity={0.5} />
      <Circle cx={362} cy={506} r={5} fill="#DDD6FE" opacity={0.5} />
      <Circle cx={404} cy={498} r={5} fill="#DDD6FE" opacity={0.5} />
      <Circle cx={95} cy={473} r={4} fill="#DDD6FE" opacity={0.4} />
      <Circle cx={145} cy={483} r={4} fill="#DDD6FE" opacity={0.4} />
      <Circle cx={210} cy={488} r={3.5} fill="#DDD6FE" opacity={0.4} />
      <Circle cx={302} cy={488} r={3.5} fill="#DDD6FE" opacity={0.4} />
      <Circle cx={367} cy={483} r={4} fill="#DDD6FE" opacity={0.4} />
      <Circle cx={417} cy={473} r={4} fill="#DDD6FE" opacity={0.4} />

      {/* === BODY === */}
      <Ellipse cx={256} cy={268} rx={130} ry={140} fill="url(#bodyGrad)" />
      <Ellipse cx={240} cy={223} rx={80} ry={70} fill="url(#shine)" opacity={0.5} />

      {/* === FACE === */}
      {/* Eyes white */}
      <Ellipse cx={210} cy={263} rx={38} ry={42} fill="white" />
      <Ellipse cx={302} cy={263} rx={38} ry={42} fill="white" />
      {/* Iris */}
      <Ellipse cx={215} cy={268} rx={22} ry={26} fill="#1E1B4B" />
      <Ellipse cx={307} cy={268} rx={22} ry={26} fill="#1E1B4B" />
      {/* Pupil */}
      <Ellipse cx={218} cy={266} rx={12} ry={14} fill="#0F0A2A" />
      <Ellipse cx={310} cy={266} rx={12} ry={14} fill="#0F0A2A" />
      {/* Shine */}
      <Circle cx={224} cy={256} r={8} fill="white" opacity={0.9} />
      <Circle cx={316} cy={256} r={8} fill="white" opacity={0.9} />
      <Circle cx={212} cy={272} r={4} fill="white" opacity={0.5} />
      <Circle cx={304} cy={272} r={4} fill="white" opacity={0.5} />
      {/* Eyebrows */}
      <Path d="M180 230 Q195 220 225 226" stroke="#6D28D9" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <Path d="M287 226 Q317 220 332 230" stroke="#6D28D9" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      {/* Smile */}
      <Path d="M228 316 Q256 343 284 316" stroke="#6D28D9" strokeWidth={4} fill="none" strokeLinecap="round" />
      {/* Cheeks */}
      <Ellipse cx={170} cy={303} rx={20} ry={14} fill="url(#cheek)" opacity={0.45} />
      <Ellipse cx={342} cy={303} rx={20} ry={14} fill="url(#cheek)" opacity={0.45} />

      {/* === PIRATE HAT === */}
      {/* Brim */}
      <Ellipse cx={256} cy={155} rx={155} ry={22} fill="#1A1A1A" />
      <Ellipse cx={256} cy={153} rx={150} ry={18} fill="#2D2D2D" />
      <Ellipse cx={256} cy={151} rx={145} ry={14} fill="url(#hatG)" />
      {/* Hat body */}
      <Path d="M145 155 Q140 100 165 60 Q195 20 256 8 Q317 20 347 60 Q372 100 367 155 Z" fill="url(#hatG)" />
      {/* Highlight */}
      <Path d="M175 140 Q178 95 200 62 Q225 32 256 25 Q280 32 300 55 Q310 72 310 90" fill="white" opacity={0.06} />
      {/* Band */}
      <Path d="M152 145 Q155 138 165 135 Q210 128 256 126 Q302 128 347 135 Q357 138 360 145 Q357 152 347 155 Q302 162 256 164 Q210 162 165 155 Q155 152 152 145 Z" fill="url(#band)" />
      {/* Skull */}
      <Ellipse cx={256} cy={88} rx={18} ry={20} fill="url(#skull)" />
      <Ellipse cx={256} cy={95} rx={12} ry={8} fill="url(#skull)" />
      <Ellipse cx={249} cy={84} rx={5} ry={6} fill="#1A1A1A" />
      <Ellipse cx={263} cy={84} rx={5} ry={6} fill="#1A1A1A" />
      <Path d="M254 92 L256 96 L258 92" fill="#1A1A1A" stroke="#1A1A1A" strokeWidth={1} />
      <Path d="M248 100 L264 100" stroke="#1A1A1A" strokeWidth={1.5} />
      <Line x1={251} y1={100} x2={251} y2={103} stroke="#1A1A1A" strokeWidth={1} />
      <Line x1={256} y1={100} x2={256} y2={103} stroke="#1A1A1A" strokeWidth={1} />
      <Line x1={261} y1={100} x2={261} y2={103} stroke="#1A1A1A" strokeWidth={1} />
      {/* Crossbones */}
      <Path d="M228 78 Q245 95 270 108" stroke="url(#skull)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Path d="M228 108 Q245 95 270 78" stroke="url(#skull)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <Circle cx={226} cy={76} r={4} fill="url(#skull)" />
      <Circle cx={226} cy={110} r={4} fill="url(#skull)" />
      <Circle cx={272} cy={76} r={4} fill="url(#skull)" />
      <Circle cx={272} cy={110} r={4} fill="url(#skull)" />
      {/* Hat edge detail */}
      <Path d="M145 155 Q150 148 170 145" stroke="#3D3D3D" strokeWidth={1.5} fill="none" opacity={0.5} />
      <Path d="M367 155 Q362 148 342 145" stroke="#3D3D3D" strokeWidth={1.5} fill="none" opacity={0.5} />
    </Svg>
  );
}
