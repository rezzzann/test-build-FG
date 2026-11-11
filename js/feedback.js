
export function initFeedbackReminder({
  $,
  getHandNo,
  getGamePaused,
  getTournamentMode,
  setGamePaused
}) {
  const shownModes = new Set();
  let resolveReminder = null;

  function showAfterThirdHand() {
    const mode = getTournamentMode();

    if (
      getHandNo() !== 3 ||
      getGamePaused() ||
      shownModes.has(mode)
    ) {
      return Promise.resolve(false);
    }

    shownModes.add(mode);
    setGamePaused(true);
    $('feedbackReminder').classList.add('visible');

    return new Promise(resolve => {
      resolveReminder = resolve;
    });
  }

  $('feedbackDismiss').addEventListener('click', () => {
    $('feedbackReminder').classList.remove('visible');

    if (resolveReminder) {
      const resolve = resolveReminder;
      resolveReminder = null;

      setGamePaused(false);
      resolve(true);
    }
  });

  return { showAfterThirdHand };
}
