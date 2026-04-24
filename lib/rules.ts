export const wellnessRules = {
  good: 4,
  normal: 3,
};

export const cmjRules = {
  greenDelta: 1.5,
  yellowDelta: 0,
};

export const getTrafficLight = (value: number) => {
  if (value >= wellnessRules.good) return 'green';
  if (value >= wellnessRules.normal) return 'yellow';
  return 'red';
};

export const getPlayerStatusTone = (status: string) => {
  if (status === 'Disponible') return 'green';
  if (status === 'Molestia') return 'yellow';
  if (status === 'Readaptación') return 'orange';
  return 'red';
};

export const getCmjTone = (value: number, average: number) => {
  const delta = value - average;
  if (delta >= cmjRules.greenDelta) return 'green';
  if (delta >= cmjRules.yellowDelta) return 'yellow';
  return 'red';
};
