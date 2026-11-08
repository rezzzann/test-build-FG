// Статистика игроков в рамках текущего турнира.
// Общая статистика между турнирами здесь пока не сохраняется.

export function initializeTournamentStats(players) {
  players.forEach(player => {
    player.tournamentStats = {
      wins: 0,
      losses: 0,
      maxStack: Number(player.stack) || 0
    };

    player.eliminated = false;
    player.showTournamentStats = false;
  });
}

export function recordCompletedHand(players, winnerIndexes) {
  const winners = new Set(winnerIndexes);

  players.forEach((player, index) => {
    // Игрок участвовал, если ему были розданы карты.
    if (!player.hole?.length || player.eliminated) return;

    if (winners.has(index)) {
      player.tournamentStats.wins++;
    } else {
      player.tournamentStats.losses++;
    }

    // Фиксируем стек после выплаты банка.
    player.tournamentStats.maxStack = Math.max(
      player.tournamentStats.maxStack,
      Number(player.stack) || 0
    );

    // Выбывание фиксируется только после завершения раздачи.
    if (player.stack <= 0) {
      player.eliminated = true;
      player.showTournamentStats = false;
    }
  });
}
