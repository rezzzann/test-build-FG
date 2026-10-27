
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

export function createTournamentClock({
  getMode,
  getPaused,
  getLevel,
  setLevel,
  getRemaining,
  setRemaining,
  setBlinds,
  updateDisplay,
  render
}) {
  let deadline = 0;
  let timer = null;
  let displayTimer = null;

  function stop(preserve = true) {
    if (timer !== null) {
      if (preserve) {
        setRemaining(Math.max(0, deadline - Date.now()));
      }

      clearTimeout(timer);
      timer = null;
    }

    if (displayTimer !== null) {
      clearInterval(displayTimer);
      displayTimer = null;
    }
  }

  function start() {
    if (getPaused() || timer !== null) return;

    if (getRemaining() <= 0) {
      setRemaining(180000);
    }

    deadline = Date.now() + getRemaining();

    displayTimer = setInterval(() => {
      setRemaining(Math.max(0, deadline - Date.now()));
      updateDisplay();
    }, 250);

    timer = setTimeout(() => {
      timer = null;

      if (displayTimer !== null) {
        clearInterval(displayTimer);
        displayTimer = null;
      }

      if (getPaused()) return;

      const levels = getBlindLevels(getMode());

      if (getLevel() < levels.length - 1) {
        const nextLevel = getLevel() + 1;

        setLevel(nextLevel);
        setBlinds(levels[nextLevel]);
        setRemaining(180000);

        updateDisplay();
        render();
        start();
      } else {
        setRemaining(0);
        updateDisplay();
      }
    }, getRemaining());
  }

  return { start, stop };
}
