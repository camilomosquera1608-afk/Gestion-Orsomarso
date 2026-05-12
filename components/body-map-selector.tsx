'use client';

import { BODY_REGIONS } from '@/lib/body-map';

type Props = {
  value: string;
  onChange: (region: string) => void;
};

const regionClass = (region: string, selected: string) => `body-map-region ${selected === region ? 'selected' : ''}`;

export function BodyMapSelector({ value, onChange }: Props) {
  return (
    <div className="body-map-widget">
      <div className="body-map-svg-card" aria-label="Silueta muscular interactiva">
        <svg viewBox="0 0 260 520" role="img" aria-label="Silueta para marcar zona de dolor o lesión">
          <g className="body-map-person">
            <circle className={regionClass('Cuello', value)} cx="130" cy="42" r="24" onClick={() => onChange('Cuello')} />
            <rect className={regionClass('Cuello', value)} x="112" y="66" width="36" height="22" rx="10" onClick={() => onChange('Cuello')} />
            <path className={regionClass('Hombro', value)} d="M82 94 C98 78 118 86 130 96 C142 86 162 78 178 94 L166 126 C150 118 139 116 130 118 C121 116 110 118 94 126 Z" onClick={() => onChange('Hombro')} />
            <path className={regionClass('Pectoral', value)} d="M92 126 L130 118 L168 126 L160 178 L100 178 Z" onClick={() => onChange('Pectoral')} />
            <path className={regionClass('Abdomen/Core', value)} d="M100 180 L160 180 L154 252 L106 252 Z" onClick={() => onChange('Abdomen/Core')} />
            <path className={regionClass('Lumbar', value)} d="M106 254 L154 254 L164 304 L96 304 Z" onClick={() => onChange('Lumbar')} />
            <path className={regionClass('Cadera', value)} d="M94 306 L166 306 L158 350 L102 350 Z" onClick={() => onChange('Cadera')} />
            <path className={regionClass('Aductor', value)} d="M104 352 L128 352 L124 430 L96 430 Z M132 352 L156 352 L164 430 L136 430 Z" onClick={() => onChange('Aductor')} />
            <path className={regionClass('Cuádriceps', value)} d="M78 350 L104 352 L96 430 L70 430 Z M156 352 L182 350 L190 430 L164 430 Z" onClick={() => onChange('Cuádriceps')} />
            <path className={regionClass('Rodilla', value)} d="M68 432 L124 432 L122 460 L70 460 Z M136 432 L192 432 L190 460 L138 460 Z" onClick={() => onChange('Rodilla')} />
            <path className={regionClass('Gemelo/Sóleo', value)} d="M72 462 L122 462 L114 500 L80 500 Z M138 462 L188 462 L180 500 L146 500 Z" onClick={() => onChange('Gemelo/Sóleo')} />
            <path className={regionClass('Tobillo', value)} d="M78 502 L114 502 L112 516 L78 516 Z M146 502 L182 502 L182 516 L148 516 Z" onClick={() => onChange('Tobillo')} />
            <path className={regionClass('Pie', value)} d="M70 516 L114 516 L118 530 L64 530 Z M146 516 L190 516 L196 530 L142 530 Z" onClick={() => onChange('Pie')} />
            <path className={regionClass('Espalda alta', value)} d="M28 120 L82 96 L94 128 L64 218 L34 210 Z M178 94 L232 120 L226 210 L196 218 L166 128 Z" onClick={() => onChange('Espalda alta')} />
          </g>
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
