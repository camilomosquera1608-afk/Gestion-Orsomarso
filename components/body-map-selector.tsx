'use client';

import type { ReactNode } from 'react';
import { BODY_REGIONS } from '@/lib/body-map';

type Props = {
  value: string;
  onChange: (region: string) => void;
};

const regionClass = (region: string, selected: string) => `body-map-region ${selected === region ? 'selected' : ''}`;
const lineClass = 'body-map-muscle-line';

export function BodyMapSelector({ value, onChange }: Props) {
  const button = (region: string, children: ReactNode) => (
    <g
      role="button"
      tabIndex={0}
      aria-label={`Seleccionar ${region}`}
      onClick={() => onChange(region)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onChange(region);
      }}
    >
      {children}
    </g>
  );

  return (
    <div className="body-map-widget advanced realistic">
      <div className="body-map-svg-card" aria-label="Silueta muscular anterior interactiva">
        <div className="body-map-view-title">Vista anterior</div>
        <svg viewBox="0 0 260 560" role="img" aria-label="Vista anterior para marcar zona muscular">
          <defs>
            <linearGradient id="muscleFront" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f8fafc" />
              <stop offset="1" stopColor="#dbe3ee" />
            </linearGradient>
          </defs>

          {button('Cuello', <>
            <circle className={regionClass('Cuello', value)} cx="130" cy="32" r="25" />
            <path className={regionClass('Cuello', value)} d="M112 56 C116 70 144 70 148 56 L151 86 L109 86 Z" />
          </>)}

          {button('Hombro', <>
            <path className={regionClass('Hombro', value)} d="M58 103 C69 84 93 78 116 89 L101 124 C82 120 66 129 54 148 L35 139 C39 123 47 111 58 103 Z" />
            <path className={regionClass('Hombro', value)} d="M202 103 C191 84 167 78 144 89 L159 124 C178 120 194 129 206 148 L225 139 C221 123 213 111 202 103 Z" />
          </>)}

          {button('Pectoral', <>
            <path className={regionClass('Pectoral', value)} d="M78 115 C93 92 116 96 128 112 L124 172 C99 170 82 161 70 144 Z" />
            <path className={regionClass('Pectoral', value)} d="M182 115 C167 92 144 96 132 112 L136 172 C161 170 178 161 190 144 Z" />
            <path className={lineClass} d="M130 110 L130 176" />
          </>)}

          {button('Abdomen/Core', <>
            <path className={regionClass('Abdomen/Core', value)} d="M94 174 C108 181 122 183 130 183 C138 183 152 181 166 174 L160 266 C151 278 109 278 100 266 Z" />
            <path className={lineClass} d="M130 186 L130 270" />
            <path className={lineClass} d="M104 205 L156 205" />
            <path className={lineClass} d="M102 232 L158 232" />
            <path className={lineClass} d="M106 258 L154 258" />
          </>)}

          {button('Cadera/Glúteo', <>
            <path className={regionClass('Cadera/Glúteo', value)} d="M86 270 C102 286 118 292 130 292 C142 292 158 286 174 270 L190 322 L70 322 Z" />
            <path className={lineClass} d="M130 292 L130 322" />
          </>)}

          {button('Aductor', <>
            <path className={regionClass('Aductor', value)} d="M102 322 L127 322 L119 454 L90 454 C91 403 94 360 102 322 Z" />
            <path className={regionClass('Aductor', value)} d="M133 322 L158 322 C166 360 169 403 170 454 L141 454 Z" />
          </>)}

          {button('Cuádriceps', <>
            <path className={regionClass('Cuádriceps', value)} d="M64 322 L101 322 C93 362 90 405 90 454 L55 454 C54 410 56 360 64 322 Z" />
            <path className={regionClass('Cuádriceps', value)} d="M159 322 L196 322 C204 360 206 410 205 454 L170 454 C170 405 167 362 159 322 Z" />
            <path className={lineClass} d="M77 338 C85 372 83 415 78 452" />
            <path className={lineClass} d="M183 338 C175 372 177 415 182 452" />
          </>)}

          {button('Rodilla', <>
            <path className={regionClass('Rodilla', value)} d="M54 458 L118 458 L113 492 L58 492 Z" />
            <path className={regionClass('Rodilla', value)} d="M142 458 L206 458 L202 492 L147 492 Z" />
          </>)}

          {button('Gemelo/Sóleo', <>
            <path className={regionClass('Gemelo/Sóleo', value)} d="M60 496 L112 496 L103 540 L68 540 Z" />
            <path className={regionClass('Gemelo/Sóleo', value)} d="M148 496 L200 496 L192 540 L157 540 Z" />
          </>)}

          {button('Tobillo', <>
            <path className={regionClass('Tobillo', value)} d="M68 540 L103 540 L101 554 L66 554 Z" />
            <path className={regionClass('Tobillo', value)} d="M157 540 L192 540 L194 554 L159 554 Z" />
          </>)}

          {button('Pie', <>
            <path className={regionClass('Pie', value)} d="M57 554 L102 554 L114 566 L50 566 Z" />
            <path className={regionClass('Pie', value)} d="M158 554 L203 554 L210 566 L146 566 Z" />
          </>)}
        </svg>
      </div>

      <div className="body-map-svg-card" aria-label="Silueta muscular posterior interactiva">
        <div className="body-map-view-title">Vista posterior</div>
        <svg viewBox="0 0 260 560" role="img" aria-label="Vista posterior para marcar zona muscular">
          {button('Cuello', <>
            <circle className={regionClass('Cuello', value)} cx="130" cy="32" r="25" />
            <path className={regionClass('Cuello', value)} d="M112 56 C117 72 143 72 148 56 L153 90 L107 90 Z" />
          </>)}

          {button('Hombro', <>
            <path className={regionClass('Hombro', value)} d="M55 104 C68 83 96 78 118 92 L102 128 C81 121 64 132 52 151 L32 141 C38 124 45 113 55 104 Z" />
            <path className={regionClass('Hombro', value)} d="M205 104 C192 83 164 78 142 92 L158 128 C179 121 196 132 208 151 L228 141 C222 124 215 113 205 104 Z" />
          </>)}

          {button('Espalda alta', <>
            <path className={regionClass('Espalda alta', value)} d="M74 113 C96 90 116 94 130 112 C144 94 164 90 186 113 L174 210 C151 206 140 190 130 174 C120 190 109 206 86 210 Z" />
            <path className={lineClass} d="M130 105 L130 212" />
            <path className={lineClass} d="M94 128 C112 138 120 154 130 174" />
            <path className={lineClass} d="M166 128 C148 138 140 154 130 174" />
          </>)}

          {button('Lumbar', <>
            <path className={regionClass('Lumbar', value)} d="M88 212 C105 218 118 220 130 220 C142 220 155 218 172 212 L164 272 C151 284 109 284 96 272 Z" />
            <path className={lineClass} d="M130 220 L130 282" />
          </>)}

          {button('Cadera/Glúteo', <>
            <path className={regionClass('Cadera/Glúteo', value)} d="M82 276 C98 294 113 304 130 304 C147 304 162 294 178 276 L195 326 L65 326 Z" />
            <path className={lineClass} d="M130 304 L130 326" />
            <path className={lineClass} d="M86 296 C106 304 117 309 130 326" />
            <path className={lineClass} d="M174 296 C154 304 143 309 130 326" />
          </>)}

          {button('Isquiotibial', <>
            <path className={regionClass('Isquiotibial', value)} d="M61 328 L126 328 L116 456 L55 456 C55 413 57 366 61 328 Z" />
            <path className={regionClass('Isquiotibial', value)} d="M134 328 L199 328 C203 366 205 413 205 456 L144 456 Z" />
            <path className={lineClass} d="M91 336 C98 374 96 415 88 455" />
            <path className={lineClass} d="M169 336 C162 374 164 415 172 455" />
          </>)}

          {button('Rodilla', <>
            <path className={regionClass('Rodilla', value)} d="M55 460 L116 460 L112 492 L58 492 Z" />
            <path className={regionClass('Rodilla', value)} d="M144 460 L205 460 L202 492 L148 492 Z" />
          </>)}

          {button('Gemelo/Sóleo', <>
            <path className={regionClass('Gemelo/Sóleo', value)} d="M60 496 C67 492 80 492 92 498 C104 506 108 523 102 542 L68 542 C59 523 54 505 60 496 Z" />
            <path className={regionClass('Gemelo/Sóleo', value)} d="M200 496 C193 492 180 492 168 498 C156 506 152 523 158 542 L192 542 C201 523 206 505 200 496 Z" />
          </>)}

          {button('Aquiles', <>
            <path className={regionClass('Aquiles', value)} d="M73 540 L97 540 L95 558 L74 558 Z" />
            <path className={regionClass('Aquiles', value)} d="M163 540 L187 540 L186 558 L165 558 Z" />
          </>)}

          {button('Tobillo', <>
            <path className={regionClass('Tobillo', value)} d="M66 558 L102 558 L105 570 L64 570 Z" />
            <path className={regionClass('Tobillo', value)} d="M158 558 L194 558 L196 570 L155 570 Z" />
          </>)}

          {button('Pie', <>
            <path className={regionClass('Pie', value)} d="M54 570 L104 570 L116 582 L48 582 Z" />
            <path className={regionClass('Pie', value)} d="M156 570 L206 570 L212 582 L144 582 Z" />
          </>)}
        </svg>
      </div>

      <div className="body-map-region-list">
        <div className="body-map-region-list-title">Zona seleccionada</div>
        {BODY_REGIONS.map((region) => (
          <button key={region} type="button" className={value === region ? 'active' : ''} onClick={() => onChange(region)}>{region}</button>
        ))}
      </div>
    </div>
  );
}
