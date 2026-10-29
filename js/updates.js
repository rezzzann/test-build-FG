
export function initUpdates({ $, closeOverlays }) {
  function capUpdateHistory() {
    const list = $('updateList');
    if (!list) return;

    while (list.querySelectorAll('.update-item').length > 20) {
      const items = list.querySelectorAll('.update-item');
      items[items.length - 1].remove();
    }
  }

  function setUpdatesExpanded(expanded) {
    const list = $('updateList');
    const button = $('toggleUpdatesButton');

    if (!list || !button) return;

    list.classList.toggle('show-all', expanded);
    button.textContent = expanded ? 'СКРЫТЬ ВСЕ' : 'ПОКАЗАТЬ ЕЩЁ';
    button.setAttribute('aria-expanded', String(expanded));
    button.hidden = list.querySelectorAll('.update-item').length <= 5;
  }

  capUpdateHistory();
  setUpdatesExpanded(false);

  $('toggleUpdatesButton').addEventListener('click', () => {
    const list = $('updateList');
    setUpdatesExpanded(!list.classList.contains('show-all'));
  });

  $('updatesButton').addEventListener('click', () => {
    closeOverlays();
    setUpdatesExpanded(false);
    $('updatesOverlay').classList.add('visible');
  });
}

