
export function initFeedbackReminder({
  $,
  getHandNo,
  getGamePaused,
  getTournamentMode
}) {
  const shownModes = new Set();

  function showAfterThirdHand() {
    const mode = getTournamentMode();

    if (
      getHandNo() !== 3 ||
      getGamePaused() ||
      shownModes.has(mode)
    ) {
      return;
    }

    shownModes.add(mode);
    $('feedbackReminder').classList.add('visible');
  }

  $('feedbackDismiss').addEventListener('click', () => {
    $('feedbackReminder').classList.remove('visible');
  });

  return { showAfterThirdHand };
}

