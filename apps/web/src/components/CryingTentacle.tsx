interface CryingTentacleProps {
  size?: number;
}

/**
 * Poulpe pirate qui pleure — SVG animé pour le web
 * Larmes qui coulent + balancement doux + tentacules vivantes
 */
export function CryingTentacle({ size = 120 }: CryingTentacleProps) {
  return (
    <svg
      width={size}
      height={size * (560 / 512)}
      viewBox="0 0 512 560"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ animation: "tentacle-sway 3s ease-in-out infinite" }}
    >
      <defs>
        <linearGradient id="ct-bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="ct-tg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7C3AED" />
          <stop offset="100%" stopColor="#DB2777" />
        </linearGradient>
        <linearGradient id="ct-tg2" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#9333EA" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <linearGradient id="ct-cheek" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#F9A8D4" />
          <stop offset="100%" stopColor="#F472B6" />
        </linearGradient>
        <linearGradient id="ct-shine" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity={0.35} />
          <stop offset="100%" stopColor="white" stopOpacity={0} />
        </linearGradient>
        <linearGradient id="ct-hatG" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#2D2D2D" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </linearGradient>
        <linearGradient id="ct-band" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#8B5CF6" />
          <stop offset="50%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#EC4899" />
        </linearGradient>
        <linearGradient id="ct-skull" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E2E8F0" />
        </linearGradient>
        <linearGradient id="ct-tearGrad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#93C5FD" />
          <stop offset="100%" stopColor="#3B82F6" />
        </linearGradient>
      </defs>

      {/* Tentacles with wiggle */}
      <g style={{ animation: "tentacle-wiggle 2s ease-in-out infinite", transformOrigin: "256px 370px" }}>
        <path d="M160 358 Q120 418 100 468 Q85 508 110 528 Q130 543 145 518 Q160 493 155 448 Q152 418 170 388" fill="url(#ct-tg1)" opacity={0.85} />
        <path d="M352 358 Q392 418 412 468 Q427 508 402 528 Q382 543 367 518 Q352 493 357 448 Q360 418 342 388" fill="url(#ct-tg1)" opacity={0.85} />
        <path d="M140 348 Q90 388 60 448 Q40 498 65 523 Q88 546 100 508 Q115 468 120 428 Q125 398 150 368" fill="url(#ct-tg2)" opacity={0.8} />
        <path d="M372 348 Q422 388 452 448 Q472 498 447 523 Q424 546 412 508 Q397 468 392 428 Q387 398 362 368" fill="url(#ct-tg2)" opacity={0.8} />
        <path d="M185 363 Q165 428 150 478 Q138 518 160 536 Q180 550 188 520 Q195 490 195 448 Q195 413 200 383" fill="url(#ct-tg1)" />
        <path d="M327 363 Q347 428 362 478 Q374 518 352 536 Q332 550 324 520 Q317 490 317 448 Q317 413 312 383" fill="url(#ct-tg1)" />
        <path d="M220 373 Q210 438 205 488 Q200 523 220 538 Q240 548 242 516 Q244 484 240 448 Q237 418 235 388" fill="url(#ct-tg2)" />
        <path d="M292 373 Q302 438 307 488 Q312 523 292 538 Q272 548 270 516 Q268 484 272 448 Q275 418 277 388" fill="url(#ct-tg2)" />
        {/* Suction cups */}
        <circle cx={108} cy={498} r={5} fill="#DDD6FE" opacity={0.5} />
        <circle cx={150} cy={506} r={5} fill="#DDD6FE" opacity={0.5} />
        <circle cx={215} cy={510} r={4} fill="#DDD6FE" opacity={0.5} />
        <circle cx={297} cy={510} r={4} fill="#DDD6FE" opacity={0.5} />
        <circle cx={362} cy={506} r={5} fill="#DDD6FE" opacity={0.5} />
        <circle cx={404} cy={498} r={5} fill="#DDD6FE" opacity={0.5} />
        <circle cx={95} cy={473} r={4} fill="#DDD6FE" opacity={0.4} />
        <circle cx={145} cy={483} r={4} fill="#DDD6FE" opacity={0.4} />
        <circle cx={210} cy={488} r={3.5} fill="#DDD6FE" opacity={0.4} />
        <circle cx={302} cy={488} r={3.5} fill="#DDD6FE" opacity={0.4} />
        <circle cx={367} cy={483} r={4} fill="#DDD6FE" opacity={0.4} />
        <circle cx={417} cy={473} r={4} fill="#DDD6FE" opacity={0.4} />
      </g>

      {/* Body with breathing */}
      <g style={{ animation: "tentacle-breathe 2.5s ease-in-out infinite", transformOrigin: "256px 268px" }}>
        <ellipse cx={256} cy={268} rx={130} ry={140} fill="url(#ct-bodyGrad)" />
        <ellipse cx={240} cy={223} rx={80} ry={70} fill="url(#ct-shine)" opacity={0.5} />
      </g>

      {/* Face */}
      <ellipse cx={210} cy={263} rx={38} ry={42} fill="white" />
      <ellipse cx={302} cy={263} rx={38} ry={42} fill="white" />
      <ellipse cx={215} cy={268} rx={22} ry={26} fill="#1E1B4B" />
      <ellipse cx={307} cy={268} rx={22} ry={26} fill="#1E1B4B" />
      <ellipse cx={218} cy={266} rx={12} ry={14} fill="#0F0A2A" />
      <ellipse cx={310} cy={266} rx={12} ry={14} fill="#0F0A2A" />
      {/* Pupils with look-around animation */}
      <g style={{ animation: "tentacle-look 4s ease-in-out infinite" }}>
        <circle cx={224} cy={256} r={8} fill="white" opacity={0.9} />
        <circle cx={316} cy={256} r={8} fill="white" opacity={0.9} />
      </g>
      <circle cx={212} cy={272} r={4} fill="white" opacity={0.5} />
      <circle cx={304} cy={272} r={4} fill="white" opacity={0.5} />
      {/* Sad eyebrows */}
      <path d="M180 222 Q200 232 225 230" stroke="#6D28D9" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      <path d="M287 230 Q312 232 332 222" stroke="#6D28D9" strokeWidth={3.5} fill="none" strokeLinecap="round" />
      {/* Sad mouth with tremble */}
      <path d="M228 328 Q256 305 284 328" stroke="#6D28D9" strokeWidth={4} fill="none" strokeLinecap="round"
        style={{ animation: "tentacle-tremble 1.5s ease-in-out infinite" }} />

      {/* Animated tears — left eye */}
      <ellipse cx={198} cy={308} rx={5} ry={7} fill="url(#ct-tearGrad)"
        style={{ animation: "tear-fall-left 2s ease-in infinite" }} />
      <ellipse cx={195} cy={308} rx={4} ry={6} fill="url(#ct-tearGrad)"
        style={{ animation: "tear-fall-left 2s ease-in 0.7s infinite" }} />
      <ellipse cx={202} cy={308} rx={3} ry={5} fill="url(#ct-tearGrad)"
        style={{ animation: "tear-fall-left 2s ease-in 1.3s infinite" }} />

      {/* Animated tears — right eye */}
      <ellipse cx={314} cy={308} rx={5} ry={7} fill="url(#ct-tearGrad)"
        style={{ animation: "tear-fall-right 2s ease-in 0.3s infinite" }} />
      <ellipse cx={317} cy={308} rx={4} ry={6} fill="url(#ct-tearGrad)"
        style={{ animation: "tear-fall-right 2s ease-in 1s infinite" }} />
      <ellipse cx={310} cy={308} rx={3} ry={5} fill="url(#ct-tearGrad)"
        style={{ animation: "tear-fall-right 2s ease-in 1.6s infinite" }} />

      {/* Cheeks */}
      <ellipse cx={170} cy={303} rx={20} ry={14} fill="url(#ct-cheek)" opacity={0.45} />
      <ellipse cx={342} cy={303} rx={20} ry={14} fill="url(#ct-cheek)" opacity={0.45} />

      {/* Pirate hat */}
      <ellipse cx={256} cy={155} rx={155} ry={22} fill="#1A1A1A" />
      <ellipse cx={256} cy={153} rx={150} ry={18} fill="#2D2D2D" />
      <ellipse cx={256} cy={151} rx={145} ry={14} fill="url(#ct-hatG)" />
      <path d="M145 155 Q140 100 165 60 Q195 20 256 8 Q317 20 347 60 Q372 100 367 155 Z" fill="url(#ct-hatG)" />
      <path d="M175 140 Q178 95 200 62 Q225 32 256 25 Q280 32 300 55 Q310 72 310 90" fill="white" opacity={0.06} />
      <path d="M152 145 Q155 138 165 135 Q210 128 256 126 Q302 128 347 135 Q357 138 360 145 Q357 152 347 155 Q302 162 256 164 Q210 162 165 155 Q155 152 152 145 Z" fill="url(#ct-band)" />
      {/* Skull */}
      <ellipse cx={256} cy={88} rx={18} ry={20} fill="url(#ct-skull)" />
      <ellipse cx={256} cy={95} rx={12} ry={8} fill="url(#ct-skull)" />
      <ellipse cx={249} cy={84} rx={5} ry={6} fill="#1A1A1A" />
      <ellipse cx={263} cy={84} rx={5} ry={6} fill="#1A1A1A" />
      <path d="M254 92 L256 96 L258 92" fill="#1A1A1A" stroke="#1A1A1A" strokeWidth={1} />
      <path d="M248 100 L264 100" stroke="#1A1A1A" strokeWidth={1.5} />
      <line x1={251} y1={100} x2={251} y2={103} stroke="#1A1A1A" strokeWidth={1} />
      <line x1={256} y1={100} x2={256} y2={103} stroke="#1A1A1A" strokeWidth={1} />
      <line x1={261} y1={100} x2={261} y2={103} stroke="#1A1A1A" strokeWidth={1} />
      {/* Crossbones */}
      <path d="M228 78 Q245 95 270 108" stroke="url(#ct-skull)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <path d="M228 108 Q245 95 270 78" stroke="url(#ct-skull)" strokeWidth={5} fill="none" strokeLinecap="round" />
      <circle cx={226} cy={76} r={4} fill="url(#ct-skull)" />
      <circle cx={226} cy={110} r={4} fill="url(#ct-skull)" />
      <circle cx={272} cy={76} r={4} fill="url(#ct-skull)" />
      <circle cx={272} cy={110} r={4} fill="url(#ct-skull)" />
      <path d="M145 155 Q150 148 170 145" stroke="#3D3D3D" strokeWidth={1.5} fill="none" opacity={0.5} />
      <path d="M367 155 Q362 148 342 145" stroke="#3D3D3D" strokeWidth={1.5} fill="none" opacity={0.5} />
    </svg>
  );
}
