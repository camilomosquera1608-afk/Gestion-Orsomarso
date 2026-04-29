import { getPlayerStatusTone, getTrafficLight } from '@/lib/rules';

type BadgeTone = 'green' | 'yellow' | 'orange' | 'red' | 'blue' | 'neutral' | 'dark' | 'amber';

const normalizeTone = (tone: BadgeTone) => {
  if (tone === 'yellow' || tone === 'orange') return 'amber';
  return tone;
};

export const ToneBadge = ({ text, tone }: { text: string; tone: BadgeTone }) => (
  <span className={`badge status-badge ui-tone-${normalizeTone(tone)}`}>{text}</span>
);

export const WellnessBadge = ({ value }: { value: number }) => {
  const tone = getTrafficLight(value) as 'green' | 'yellow' | 'red';
  return <ToneBadge text={`Wellness ${value.toFixed(1)}`} tone={tone} />;
};

export const PlayerStatusBadge = ({ status }: { status: string }) => {
  const tone = getPlayerStatusTone(status) as 'green' | 'yellow' | 'orange' | 'red';
  return <ToneBadge text={status} tone={tone} />;
};
