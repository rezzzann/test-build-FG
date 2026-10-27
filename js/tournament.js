
export const BLIND_LEVELS = {
  classic: [
    [10, 20],
    [25, 50],
    [50, 100],
    [100, 200],
    [150, 300],
    [200, 400],
    [250, 500],
    [300, 600],
    [400, 800]
  ],
  highroller: [
    [100, 200],
    [200, 400],
    [250, 500],
    [500, 1000],
    [750, 1500],
    [1000, 2000],
    [1500, 3000],
    [2000, 4000],
    [4000, 8000]
  ]
};

export function getStartingStack(mode) {
  return mode === 'highroller' ? 10000 : 1000;
}

export function getBlindLevels(mode) {
  return BLIND_LEVELS[mode] || BLIND_LEVELS.classic;
}

