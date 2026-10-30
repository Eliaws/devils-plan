// Portraits de chasseurs dessinés en SVG (repère 120 × 120, buste centré).
// Style commun : aplats de couleur, ombres en tons plus sombres, pas de contour.
// Du plus sérieux (Traqueuse) au plus rigolo (Fantôme repenti).

import type { AvatarId } from '@umbra/protocol';
import type { ReactNode } from 'react';

export interface Portrait {
  /** Fond du médaillon : centre puis bord. */
  background: [string, string];
  art: ReactNode;
}

/** Buste générique (épaules), couleur du vêtement. */
const Shoulders = ({ fill, shade }: { fill: string; shade: string }) => (
  <>
    <path d="M10 124 C14 96 36 86 60 86 C84 86 106 96 110 124 Z" fill={fill} />
    <path d="M60 86 C50 86 42 88 36 92 C44 100 52 104 60 104 C68 104 76 100 84 92 C78 88 70 86 60 86 Z" fill={shade} />
  </>
);

export const PORTRAITS: Record<AvatarId, Portrait> = {
  // --- Sérieux ---------------------------------------------------------------
  traqueuse: {
    background: ['#2f5a45', '#0c1712'],
    art: (
      <>
        <path d="M8 124 C12 94 34 82 60 82 C86 82 108 94 112 124 Z" fill="#1f2a24" />
        {/* Sangle du carquois */}
        <path d="M34 92 L92 124 L84 124 L30 97 Z" fill="#5a3b24" />
        {/* Capuche */}
        <path
          d="M60 14 C34 16 26 42 28 66 C30 86 42 98 60 100 C78 98 90 86 92 66 C94 42 86 16 60 14 Z"
          fill="#2e3e35"
        />
        <path d="M60 14 C48 16 40 26 38 38 C46 28 54 24 60 24 C66 24 74 28 82 38 C80 26 72 16 60 14 Z" fill="#3c5145" />
        {/* Visage dans l'ombre */}
        <ellipse cx="60" cy="62" rx="17" ry="22" fill="#0a0e0c" />
        {/* Yeux luisants */}
        <ellipse cx="53" cy="58" rx="6" ry="3.5" fill="#7dffb0" opacity="0.18" />
        <ellipse cx="67" cy="58" rx="6" ry="3.5" fill="#7dffb0" opacity="0.18" />
        <path d="M49 58 Q53 55.5 57 58 Q53 59.5 49 58 Z" fill="#c8ffd9" />
        <path d="M63 58 Q67 55.5 71 58 Q67 59.5 63 58 Z" fill="#c8ffd9" />
        {/* Foulard */}
        <path d="M42 68 Q60 76 78 68 L80 86 Q60 96 40 86 Z" fill="#6e2f22" />
        <path d="M42 68 Q60 76 78 68 L78.5 72 Q60 80 41.5 72 Z" fill="#8a3d2c" />
      </>
    ),
  },

  veteran: {
    background: ['#7a4a26', '#2a170b'],
    art: (
      <>
        <Shoulders fill="#3d2b1e" shade="#2a1d14" />
        {/* Col relevé */}
        <path d="M38 90 L48 78 L60 92 L72 78 L82 90 L72 98 L60 94 L48 98 Z" fill="#4e3726" />
        {/* Cou et visage */}
        <rect x="52" y="74" width="16" height="14" fill="#b4835e" />
        <ellipse cx="60" cy="58" rx="18" ry="21" fill="#c99a72" />
        {/* Barbe de trois jours */}
        <path
          d="M43 60 C44 74 52 80 60 80 C68 80 76 74 77 60 C72 68 66 70 60 70 C54 70 48 68 43 60 Z"
          fill="#8c8a86"
          opacity="0.85"
        />
        <path d="M53 70 Q60 67 67 70" stroke="#3b2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Cache-œil */}
        <path d="M38 50 L82 44" stroke="#1a1410" strokeWidth="2" />
        <ellipse cx="52" cy="54" rx="6.5" ry="5.5" fill="#1a1410" />
        {/* Œil restant et sourcil */}
        <ellipse cx="68" cy="55" rx="2.6" ry="2" fill="#1f1712" />
        <path d="M63 49 L74 47" stroke="#5b4636" strokeWidth="2.4" strokeLinecap="round" />
        {/* Cicatrice */}
        <path d="M70 58 L76 70" stroke="#9c4f3f" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M71 62 L75 61 M72.5 66 L76.5 65" stroke="#9c4f3f" strokeWidth="1" />
        {/* Chapeau à large bord */}
        <ellipse cx="60" cy="40" rx="42" ry="9" fill="#2a1d14" />
        <path d="M38 40 C38 18 82 18 82 40 Z" fill="#35261a" />
        <path d="M39 36 C46 38 74 38 81 36 L82 40 C74 42 46 42 38 40 Z" fill="#7a2020" />
      </>
    ),
  },

  inquisitrice: {
    background: ['#6e1a2f', '#1f060d'],
    art: (
      <>
        {/* Cheveux longs derrière */}
        <path d="M36 50 C34 80 32 100 40 112 L80 112 C88 100 86 80 84 50 C84 30 36 30 36 50 Z" fill="#20141f" />
        <Shoulders fill="#2a1b2a" shade="#1c121c" />
        {/* Haut col et boutons dorés */}
        <path d="M44 84 L50 96 L60 90 L70 96 L76 84 L70 78 L60 82 L50 78 Z" fill="#3a2639" />
        <circle cx="60" cy="100" r="1.8" fill="#e3ac52" />
        <circle cx="60" cy="108" r="1.8" fill="#e3ac52" />
        <rect x="53" y="72" width="14" height="12" fill="#d9b298" />
        <ellipse cx="60" cy="58" rx="17" ry="21" fill="#e8c3a8" />
        {/* Mèches sur le front */}
        <path d="M43 52 C46 38 56 34 64 36 C58 40 52 46 50 56 Z" fill="#20141f" />
        <path d="M77 52 C75 42 70 37 64 36 C70 42 72 48 72 56 Z" fill="#20141f" />
        {/* Regard déterminé */}
        <path d="M49 56 L57 58" stroke="#2a1a22" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M71 56 L63 58" stroke="#2a1a22" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M48 51 L57 53 M72 51 L63 53" stroke="#3b2433" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M55 70 Q60 72 65 70 Q60 74 55 70 Z" fill="#9c1f2e" />
        {/* Tricorne */}
        <path d="M30 40 C40 30 50 22 60 20 C70 22 80 30 90 40 C80 36 70 36 60 38 C50 36 40 36 30 40 Z" fill="#1a1418" />
        <path d="M30 40 C40 36 50 36 60 38 C70 36 80 36 90 40" stroke="#e3ac52" strokeWidth="1.4" fill="none" />
        <circle cx="60" cy="30" r="2.6" fill="#e3ac52" />
      </>
    ),
  },

  corbeau: {
    background: ['#3d4258', '#11121a'],
    art: (
      <>
        <Shoulders fill="#16161d" shade="#0d0d12" />
        <path d="M44 86 L60 112 L76 86" stroke="#2e2e3a" strokeWidth="2" fill="none" />
        {/* Masque de cuir */}
        <ellipse cx="60" cy="60" rx="18" ry="22" fill="#d6c8a8" />
        <path d="M42 62 C44 78 52 84 60 84 C68 84 76 78 78 62 C70 70 50 70 42 62 Z" fill="#c4b38f" />
        {/* Bec */}
        <path d="M54 64 C64 64 84 78 96 98 C82 92 66 84 52 76 Z" fill="#cdbb95" />
        <path d="M54 72 C66 76 82 86 96 98 C80 94 64 86 52 76 Z" fill="#a8956f" />
        <circle cx="62" cy="67" r="1" fill="#6b5a3f" />
        <circle cx="66" cy="69" r="1" fill="#6b5a3f" />
        {/* Lunettes cerclées */}
        <circle cx="52" cy="56" r="7" fill="#2a2620" />
        <circle cx="68" cy="56" r="7" fill="#2a2620" />
        <circle cx="52" cy="56" r="5" fill="#f2b84b" />
        <circle cx="68" cy="56" r="5" fill="#f2b84b" />
        <circle cx="50.5" cy="54.5" r="1.6" fill="#fff4d2" />
        <circle cx="66.5" cy="54.5" r="1.6" fill="#fff4d2" />
        {/* Chapeau */}
        <ellipse cx="60" cy="38" rx="38" ry="7" fill="#121218" />
        <path d="M42 38 L44 16 C54 13 66 13 76 16 L78 38 Z" fill="#1b1b24" />
        <rect x="43.5" y="31" width="33" height="4" fill="#3d4258" />
      </>
    ),
  },

  'lame-rouge': {
    background: ['#7a1820', '#1c0507'],
    art: (
      <>
        {/* Poignée de sabre au-dessus de l'épaule */}
        <path d="M80 104 L102 52" stroke="#2f2119" strokeWidth="6" strokeLinecap="round" />
        <path d="M95 70 L103 73" stroke="#e3ac52" strokeWidth="4" strokeLinecap="round" />
        <circle cx="102.5" cy="51" r="3.4" fill="#e3ac52" />
        <Shoulders fill="#2a2a31" shade="#1c1c21" />
        <path d="M30 104 C44 96 76 96 90 104" stroke="#a3202c" strokeWidth="3" fill="none" />
        <rect x="52" y="72" width="16" height="14" fill="#c4936d" />
        <ellipse cx="60" cy="58" rx="17" ry="21" fill="#d8a882" />
        {/* Cheveux et chignon */}
        <path d="M42 54 C40 36 50 30 60 30 C70 30 80 36 78 54 C74 44 66 40 60 40 C54 40 46 44 42 54 Z" fill="#141016" />
        <circle cx="60" cy="25" r="7" fill="#141016" />
        {/* Bandeau rouge et rubans */}
        <path d="M42 46 C50 42 70 42 78 46 L78 51 C70 47 50 47 42 51 Z" fill="#c8232f" />
        <path d="M78 47 C88 46 94 52 100 50 C96 56 88 54 80 51 Z" fill="#c8232f" />
        <path d="M79 50 C86 54 90 62 96 62 C90 66 84 60 79 53 Z" fill="#a31b26" />
        {/* Regard féroce */}
        <path d="M48 55 L57 58" stroke="#1a1214" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M72 55 L63 58" stroke="#1a1214" strokeWidth="2.4" strokeLinecap="round" />
        <path d="M54 71 L66 71" stroke="#6b3a2e" strokeWidth="2" strokeLinecap="round" />
        <path d="M44 63 L49 66" stroke="#b5243a" strokeWidth="1.4" strokeLinecap="round" />
      </>
    ),
  },

  // --- Entre les deux --------------------------------------------------------
  'chasseur-de-primes': {
    background: ['#8a6a35', '#2e200c'],
    art: (
      <>
        {/* Poncho à rayures */}
        <path d="M8 124 C12 96 36 84 60 84 C84 84 108 96 112 124 Z" fill="#7a4f2c" />
        <path d="M14 112 C30 104 90 104 106 112 L108 118 C90 110 30 110 12 118 Z" fill="#c9a35a" />
        <path d="M20 100 C34 94 86 94 100 100 L102 105 C86 99 34 99 18 105 Z" fill="#a3402e" />
        {/* Bandana */}
        <path d="M44 80 L76 80 L60 98 Z" fill="#b3282e" />
        <rect x="53" y="70" width="14" height="12" fill="#a87650" />
        <ellipse cx="60" cy="58" rx="17" ry="20" fill="#b8835a" />
        <path d="M44 62 C46 74 53 78 60 78 C67 78 74 74 76 62 C70 68 50 68 44 62 Z" fill="#6e5038" opacity="0.6" />
        {/* Yeux plissés et sourire en coin */}
        <path d="M49 56 L56 56 M64 56 L71 56" stroke="#2a1d14" strokeWidth="2.2" strokeLinecap="round" />
        <path d="M53 69 Q60 71 67 66" stroke="#3b2a20" strokeWidth="2" fill="none" strokeLinecap="round" />
        {/* Cure-dent */}
        <path d="M65 67 L80 63" stroke="#e8d3a3" strokeWidth="1.6" strokeLinecap="round" />
        {/* Chapeau de cow-boy */}
        <path d="M18 42 C30 50 90 50 102 42 C96 46 88 38 60 38 C32 38 24 46 18 42 Z" fill="#3b2716" />
        <path d="M40 40 C40 22 46 18 52 22 C56 18 64 18 68 22 C74 18 80 22 80 40 Z" fill="#4a321c" />
        <path d="M41 35 C50 37 70 37 79 35 L80 40 C70 42 50 42 40 40 Z" fill="#2a1b0f" />
      </>
    ),
  },

  // --- Rigolos ---------------------------------------------------------------
  mamie: {
    background: ['#7a5a96', '#241830'],
    art: (
      <>
        <Shoulders fill="#8f6aa3" shade="#76548a" />
        <circle cx="60" cy="100" r="2" fill="#f2e3b3" />
        <circle cx="60" cy="110" r="2" fill="#f2e3b3" />
        {/* Collier d'ail */}
        <path d="M34 88 Q60 108 86 88" stroke="#c9b58a" strokeWidth="1.2" fill="none" />
        {[
          [38, 92],
          [48, 99],
          [60, 102],
          [72, 99],
          [82, 92],
        ].map(([x, y]) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <path d="M0 -5 C4 -5 6 0 5 3 C3 6 -3 6 -5 3 C-6 0 -4 -5 0 -5 Z" fill="#f6f1e4" />
            <path d="M0 -5 L0 -8 M-2 -1 Q0 3 2 -1" stroke="#c9bfa4" strokeWidth="0.8" fill="none" />
          </g>
        ))}
        <rect x="53" y="72" width="14" height="10" fill="#e6bfa5" />
        <ellipse cx="60" cy="58" rx="19" ry="21" fill="#f0cdb3" />
        {/* Chignon blanc percé d'un pieu */}
        <circle cx="60" cy="32" r="11" fill="#ece8f2" />
        <path d="M74 20 L46 40" stroke="#8a5a32" strokeWidth="2.6" strokeLinecap="round" />
        <path d="M41 52 C40 38 48 34 60 34 C72 34 80 38 79 52 C74 44 66 42 60 42 C54 42 46 44 41 52 Z" fill="#ece8f2" />
        {/* Lunettes rondes, joues roses, grand sourire */}
        <circle cx="52" cy="57" r="6" fill="#ffffff" fillOpacity="0.25" stroke="#3a2a3a" strokeWidth="1.6" />
        <circle cx="68" cy="57" r="6" fill="#ffffff" fillOpacity="0.25" stroke="#3a2a3a" strokeWidth="1.6" />
        <path d="M58 57 L62 57" stroke="#3a2a3a" strokeWidth="1.4" />
        <path
          d="M49.5 57 Q52 55 54.5 57 M65.5 57 Q68 55 70.5 57"
          stroke="#3a2a3a"
          strokeWidth="1.6"
          fill="none"
          strokeLinecap="round"
        />
        <circle cx="46" cy="66" r="4" fill="#f29a9a" opacity="0.6" />
        <circle cx="74" cy="66" r="4" fill="#f29a9a" opacity="0.6" />
        <path d="M51 68 Q60 77 69 68 Q60 72 51 68 Z" fill="#8a2c3a" />
      </>
    ),
  },

  stagiaire: {
    background: ['#2b6b74', '#0b2226'],
    art: (
      <>
        <Shoulders fill="#d0603e" shade="#ad4d30" />
        <text x="60" y="114" textAnchor="middle" fontSize="13" fontWeight="800" fill="#ffe6c9" fontFamily="sans-serif">
          ?
        </text>
        <rect x="54" y="74" width="12" height="10" fill="#e6b88f" />
        <ellipse cx="60" cy="60" rx="18" ry="20" fill="#f2c9a0" />
        {/* Taches de rousseur */}
        <circle cx="48" cy="66" r="0.9" fill="#c9895a" />
        <circle cx="51" cy="68" r="0.9" fill="#c9895a" />
        <circle cx="72" cy="66" r="0.9" fill="#c9895a" />
        <circle cx="69" cy="68" r="0.9" fill="#c9895a" />
        {/* Grands yeux inquiets */}
        <circle cx="52" cy="60" r="5.5" fill="#ffffff" />
        <circle cx="68" cy="60" r="5.5" fill="#ffffff" />
        <circle cx="54" cy="61" r="2.6" fill="#1e2a2c" />
        <circle cx="70" cy="61" r="2.6" fill="#1e2a2c" />
        <path d="M46 52 L56 50 M74 52 L64 50" stroke="#7a4a2a" strokeWidth="1.8" strokeLinecap="round" />
        <path
          d="M53 72 Q56 70 59 72 Q62 74 65 72 Q67 70 68 71"
          stroke="#6b3a2e"
          strokeWidth="1.8"
          fill="none"
          strokeLinecap="round"
        />
        {/* Goutte de sueur */}
        <path d="M80 50 C82 54 84 57 82 59 C80 61 77 59 78 56 C78 54 79 52 80 50 Z" fill="#8fd3ff" />
        {/* Passoire en guise de casque */}
        <path d="M38 50 C38 30 82 30 82 50 Z" fill="#b9c1ca" />
        <path d="M36 50 L84 50" stroke="#8e98a3" strokeWidth="3" strokeLinecap="round" />
        {[
          [48, 40],
          [56, 37],
          [64, 37],
          [72, 40],
          [52, 45],
          [60, 43],
          [68, 45],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.5" fill="#6f7882" />
        ))}
        <path d="M84 47 L92 45" stroke="#8e98a3" strokeWidth="3" strokeLinecap="round" />
      </>
    ),
  },

  'sire-poulet': {
    background: ['#3a6aa0', '#0f1f33'],
    art: (
      <>
        {/* Plumage */}
        <path d="M14 124 C16 96 36 82 60 82 C84 82 104 96 106 124 Z" fill="#f4f1ea" />
        <path
          d="M30 104 L36 96 L42 104 L48 96 L54 104 L60 96 L66 104 L72 96 L78 104 L84 96 L90 104"
          stroke="#dcd6c8"
          strokeWidth="2"
          fill="none"
        />
        {/* Tête */}
        <circle cx="60" cy="60" r="22" fill="#f8f6f0" />
        {/* Crête */}
        <path d="M50 40 C48 32 54 30 56 36 C56 28 64 28 63 36 C66 30 72 32 69 41 Z" fill="#e0323a" />
        {/* Sourcils froncés et yeux */}
        <path d="M45 52 L55 56 M75 52 L65 56" stroke="#2a2a2a" strokeWidth="2.6" strokeLinecap="round" />
        <circle cx="51" cy="59" r="2.8" fill="#1a1a1a" />
        <circle cx="69" cy="59" r="2.8" fill="#1a1a1a" />
        <circle cx="50" cy="58" r="0.9" fill="#ffffff" />
        <circle cx="68" cy="58" r="0.9" fill="#ffffff" />
        {/* Bec et barbillon */}
        <path d="M54 64 L66 64 L60 74 Z" fill="#f2a12e" />
        <path d="M54 64 L66 64 L60 68 Z" fill="#f7bd56" />
        <path d="M58 73 C56 80 60 84 62 80 C64 77 62 74 60 73 Z" fill="#e0323a" />
        {/* Petit chapeau de chasseur, plume au vent */}
        <g transform="rotate(-14 66 36)">
          <path d="M50 38 C50 26 78 26 78 38 Z" fill="#2f5a3a" />
          <rect x="46" y="36" width="36" height="4" rx="2" fill="#244630" />
          <path d="M76 34 C86 22 94 20 98 18 C94 26 86 32 78 36 Z" fill="#e3ac52" />
        </g>
      </>
    ),
  },

  fantome: {
    background: ['#33467a', '#0d1426'],
    art: (
      <>
        {/* Lanterne (remontée pour rester dans le médaillon) */}
        <g transform="translate(-8 -10)">
          <circle cx="96" cy="98" r="16" fill="#ffd27a" opacity="0.18" />
          <path d="M90 92 L102 92 L100 108 L92 108 Z" fill="#ffd27a" />
          <rect x="89" y="88" width="14" height="4" rx="1" fill="#5a3b24" />
          <rect x="90" y="108" width="12" height="3" rx="1" fill="#5a3b24" />
          <path d="M96 88 L96 82" stroke="#5a3b24" strokeWidth="1.6" />
        </g>
        {/* Corps de fantôme ondulé */}
        <path
          d="M34 70 C34 42 46 30 60 30 C74 30 86 42 86 70 L86 112 C82 106 78 106 74 112 C70 118 66 118 62 112 C58 106 54 106 50 112 C46 118 42 118 38 112 C36 108 34 108 34 112 Z"
          fill="#eef2ff"
        />
        <path d="M80 70 C80 50 74 38 64 33 C76 36 86 48 86 70 L86 108 C84 104 82 104 80 106 Z" fill="#d3dbf5" />
        {/* Bras qui tient la lanterne */}
        <path d="M84 76 C86 74 88 74 88 72" stroke="#eef2ff" strokeWidth="6" strokeLinecap="round" fill="none" />
        {/* Visage */}
        <ellipse cx="52" cy="64" rx="3.4" ry="5" fill="#1d2440" />
        <ellipse cx="68" cy="64" rx="3.4" ry="5" fill="#1d2440" />
        <circle cx="51" cy="62" r="1.1" fill="#ffffff" />
        <circle cx="67" cy="62" r="1.1" fill="#ffffff" />
        <ellipse cx="46" cy="73" rx="4" ry="2.4" fill="#ff9fb8" opacity="0.7" />
        <ellipse cx="74" cy="73" rx="4" ry="2.4" fill="#ff9fb8" opacity="0.7" />
        <path d="M55 74 Q60 78 65 74" stroke="#1d2440" strokeWidth="1.8" fill="none" strokeLinecap="round" />
        {/* Chapeau de chasseur à plume */}
        <path d="M40 40 C40 22 80 22 80 40 Z" fill="#6b4a2c" />
        <ellipse cx="60" cy="40" rx="26" ry="5" fill="#553a22" />
        <path d="M72 30 C80 18 86 14 92 12 C88 20 82 26 76 32 Z" fill="#c8232f" />
      </>
    ),
  },
};
