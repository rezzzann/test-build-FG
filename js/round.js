
export function live(players) {
  return players.filter(player => !player.folded);
}

export function activeCount(players) {
  return players.filter(
    player => !player.folded && !player.allin && player.stack > 0
  ).length;
}

export function eligible(players, index) {
  const player = players[index];

  return !!player &&
    !player.folded &&
    !player.allin &&
    player.stack > 0;
}

export function clearActedFlags(players) {
  players.forEach(player => {
    player.actedStreet = -1;
  });
}

export function hasActedThisStreet(players, index, street) {
  return players[index].actedStreet === street;
}

export function rebuildQueueFromStart(players, startIndex, count) {
  const queue = [];

  for (let k = 0; k < count; k++) {
    const index = (startIndex + k + count * 10) % count;

    if (eligible(players, index)) {
      queue.push(index);
    }
  }

  return queue;
}

export function dequeue(queue, index) {
  const position = queue.indexOf(index);

  if (position >= 0) {
    queue.splice(position, 1);
  }
}

export function queueHead(queue) {
  return queue.length ? queue[0] : -1;
}

