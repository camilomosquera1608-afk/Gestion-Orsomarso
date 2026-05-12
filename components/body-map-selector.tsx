'use client';

import type { ReactNode } from 'react';
import { BODY_REGIONS } from '@/lib/body-map';

type Props = {
  value: string;
  onChange: (region: string) => void;
};

const regionClass = (region: string, selected: string) => `body-map-region ${selected === region ? 'selected' : ''}`;

export function BodyMapSelector({ value, onChange }: Props) {
  const button = (region: string, children: ReactNode) => (
    <g role="button" tabIndex={0} onClick={() => onChange(region)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') onChange(region); }}>
      {children}
    </g>
  );

  return (
    <div className="body-map-widget advanced">
      <div className="body-map-svg-card" aria-label="Silueta muscular interactiva">
        <div className="body-map-view-title">Anterior</div>
        <svg viewBox="0 0 230 520" role="img" aria-label="Vista anterior para marcar zona muscular">
          <circle className={regionClass('Cuello', value)} cx="115" cy="34" r="24" onClick={() => onChange('Cuello')} />
          <rect className={regionClass('Cuello', value)} x="99" y="58" width="32" height="24" rx="10" onClick={() => onChange('Cuello')} />
          {button('Hombro', <><path className={regionClass('Hombro', value)} d="M62 92 C78 76 98 78 115 92 C132 78 152 76 168 92 L157 126 C139 116 126 112 115 114 C104 112 91 116 73 126 Z" /><circle className={regionClass('Hombro', value)} cx="58" cy="118" r="18" /><circle className={regionClass('Hombro', value)} cx="172" cy="118" r="18" /></>)}
          <path className={regionClass('Pectoral', value)} d="M75 124 L115 114 L155 124 L148 178 L82 178 Z" onClick={() => onChange('Pectoral')} />
          <path className={regionClass('Abdomen/Core', value)} d="M83 180 L147 180 L142 252 L88 252 Z" onClick={() => onChange('Abdomen/Core')} />
          <path className={regionClass('Cadera/Glúteo', value)} d="M78 254 L152 254 L164 304 L66 304 Z" onClick={() => onChange('Cadera/Glúteo')} />
          {button('Aductor', <><path className={regionClass('Aductor', value)} d="M82 306 L112 306 L106 426 L76 426 Z" /><path className={regionClass('Aductor', value)} d="M118 306 L148 306 L154 426 L124 426 Z" /></>)}
          {button('Cuádriceps', <><path className={regionClass('Cuádriceps', value)} d="M58 306 L82 306 L76 426 L48 426 Z" /><path className={regionClass('Cuádriceps', value)} d="M148 306 L172 306 L182 426 L154 426 Z" /></>)}
          {button('Rodilla', <><path className={regionClass('Rodilla', value)} d="M48 430 L106 430 L103 462 L50 462 Z" /><path className={regionClass('Rodilla', value)} d="M124 430 L182 430 L180 462 L127 462 Z" /></>)}
          {button('Gemelo/Sóleo', <><path className={regionClass('Gemelo/Sóleo', value)} d="M52 466 L103 466 L96 502 L58 502 Z" /><path className={regionClass('Gemelo/Sóleo', value)} d="M127 466 L178 466 L172 502 L134 502 Z" /></>)}
          {button('Tobillo', <><path className={regionClass('Tobillo', value)} d="M58 504 L96 504 L96 518 L58 518 Z" /><path className={regionClass('Tobillo', value)} d="M134 504 L172 504 L172 518 L134 518 Z" /></>)}
          {button('Pie', <><path className={regionClass('Pie', value)} d="M50 518 L96 518 L104 532 L44 532 Z" /><path className={regionClass('Pie', value)} d="M134 518 L180 518 L188 532 L128 532 Z" /></>)}
          {button('Hombro', <><path className={regionClass('Hombro', value)} d="M40 132 L62 96 L76 128 L60 230 L34 222 Z" /><path className={regionClass('Hombro', value)} d="M168 96 L190 132 L196 222 L170 230 L154 128 Z" /></>)}
        </svg>
      </div>

      <div className="body-map-svg-card" aria-label="Silueta posterior interactiva">
        <div className="body-map-view-title">Posterior</div>
        <svg viewBox="0 0 230 520" role="img" aria-label="Vista posterior para marcar zona muscular">
          <circle className={regionClass('Cuello', value)} cx="115" cy="34" r="24" onClick={() => onChange('Cuello')} />
          <rect className={regionClass('Cuello', value)} x="99" y="58" width="32" height="24" rx="10" onClick={() => onChange('Cuello')} />
          <path className={regionClass('Espalda alta', value)} d="M70 92 C88 80 102 82 115 94 C128 82 142 80 160 92 L150 192 L80 192 Z" onClick={() => onChange('Espalda alta')} />
          <path className={regionClass('Lumbar', value)} d="M82 194 L148 194 L142 252 L88 252 Z" onClick={() => onChange('Lumbar')} />
          <path className={regionClass('Cadera/Glúteo', value)} d="M76 254 L154 254 L164 308 L66 308 Z" onClick={() => onChange('Cadera/Glúteo')} />
          {button('Isquiotibial', <><path className={regionClass('Isquiotibial', value)} d="M60 310 L112 310 L106 426 L52 426 Z" /><path className={regionClass('Isquiotibial', value)} d="M118 310 L170 310 L178 426 L124 426 Z" /></>)}
          {button('Rodilla', <><path className={regionClass('Rodilla', value)} d="M52 430 L106 430 L103 460 L54 460 Z" /><path className={regionClass('Rodilla', value)} d="M124 430 L178 430 L176 460 L127 460 Z" /></>)}
          {button('Gemelo/Sóleo', <><path className={regionClass('Gemelo/Sóleo', value)} d="M54 464 L103 464 L96 502 L58 502 Z" /><path className={regionClass('Gemelo/Sóleo', value)} d="M127 464 L176 464 L172 502 L134 502 Z" /></>)}
          {button('Aquiles', <><path className={regionClass('Aquiles', value)} d="M66 502 L90 502 L88 520 L66 520 Z" /><path className={regionClass('Aquiles', value)} d="M140 502 L164 502 L164 520 L142 520 Z" /></>)}
          {button('Tobillo', <><path className={regionClass('Tobillo', value)} d="M58 520 L96 520 L98 532 L56 532 Z" /><path className={regionClass('Tobillo', value)} d="M132 520 L174 520 L176 532 L134 532 Z" /></>)}
          {button('Pie', <><path className={regionClass('Pie', value)} d="M50 532 L98 532 L106 544 L44 544 Z" /><path className={regionClass('Pie', value)} d="M132 532 L180 532 L188 544 L126 544 Z" /></>)}
          {button('Hombro', <><circle className={regionClass('Hombro', value)} cx="58" cy="118" r="18" /><circle className={regionClass('Hombro', value)} cx="172" cy="118" r="18" /><path className={regionClass('Hombro', value)} d="M40 132 L62 96 L76 128 L60 230 L34 222 Z" /><path className={regionClass('Hombro', value)} d="M168 96 L190 132 L196 222 L170 230 L154 128 Z" /></>)}
        </svg>
      </div>

      <div className="body-map-region-list">
        {BODY_REGIONS.map((region) => (
          <button key={region} type="button" className={value === region ? 'active' : ''} onClick={() => onChange(region)}>{region}</button>
        ))}
      </div>
    </div>
  );
}
