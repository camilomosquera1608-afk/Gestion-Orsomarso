import { getPlayerStatusTone, getTrafficLight } from '@/lib/rules';

export const ToneBadge = ({ text, tone }: { text: string; tone: 'green' | 'yellow' | 'orange' | 'red' }) => (
  <span className={`badge tone-${tone}`}>{text}</span>
);

export const WellnessBadge = ({ value }: { value: number }) => {
  const tone = getTrafficLight(value) as 'green' | 'yellow' | 'red';
  return <ToneBadge text={`Wellness ${value.toFixed(1)}`} tone={tone} />;
};

export const PlayerStatusBadge = ({ status }: { status: string }) => {
  const tone = getPlayerStatusTone(status) as 'green' | 'yellow' | 'orange' | 'red';
  return <ToneBadge text={status} tone={tone} />;
};
