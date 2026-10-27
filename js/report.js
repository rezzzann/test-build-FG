
export function initBugReport({ $, gameVersion, endpoint, closeOverlays }) {
  const reportQuestionSets = {
    'Отображение элементов': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'ЧТО ИМЕННО ОТОБРАЖАЕТСЯ НЕПРАВИЛЬНО?',
          options: [
            'Карты или масти',
            'Игроки, аватары или имена',
            'Фишки, банк или ставки',
            'Кнопки или текст',
            'Стол или расположение элементов',
            'Анимация или переходы',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'ГДЕ ЭТО ПРОИСХОДИТ?',
          options: [
            'На игровом столе',
            'В главном меню',
            'В информационном окне',
            'В окне обновлений',
            'В другом месте'
          ]
        }
      ]
    },
    'Логика ИИ': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'КАКОЕ ПОВЕДЕНИЕ ИИ ВЫ ЗАМЕТИЛИ?',
          options: [
            'Неправильно выбирает действие',
            'Слишком часто сбрасывает карты',
            'Слишком часто уравнивает',
            'Слишком часто повышает ставку',
            'Не реагирует на ставку',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'НА КАКОЙ УЛИЦЕ ПРОИЗОШЛО?',
          options: ['Префлоп', 'Флоп', 'Тёрн', 'Ривер', 'Не уверен']
        }
      ]
    },
    'Карты и комбинации': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'КАКАЯ ИМЕННО ПРОБЛЕМА?',
          options: [
            'Неверно определена комбинация',
            'Неверно выбран победитель',
            'Неверно подсвечены выигрышные карты',
            'Общие карты отображаются неправильно',
            'Карты соперника раскрылись неверно',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'КОГДА ВОЗНИКЛА ОШИБКА?',
          options: [
            'При раздаче карт',
            'На флопе',
            'На тёрне',
            'На ривере',
            'При вскрытии карт',
            'После завершения раздачи'
          ]
        }
      ]
    },
    'Ставки и фишки': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'ЧТО РАБОТАЕТ НЕПРАВИЛЬНО?',
          options: [
            'Сумма ставки',
            'Сумма банка',
            'Размер стека',
            'Кнопка колла или чека',
            'Рейз или минимальная ставка',
            'ALL-IN',
            'Отображение фишек',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'КОГДА ЭТО ПРОИЗОШЛО?',
          options: [
            'При постановке блайндов',
            'При колле или чеке',
            'При рейзе',
            'При ALL-IN',
            'При завершении раздачи',
            'После новой раздачи'
          ]
        }
      ]
    },
    'Очередность ходов': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'ЧТО ИМЕННО СЛУЧИЛОСЬ?',
          options: [
            'ИИ сделал два хода подряд',
            'ИИ пропустил ход',
            'Ход перешёл не тому игроку',
            'Игра зависла в ожидании хода',
            'Новая улица началась слишком рано',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'НА КАКОМ ЭТАПЕ?',
          options: [
            'Префлоп',
            'Флоп',
            'Тёрн',
            'Ривер',
            'Между раздачами',
            'Не уверен'
          ]
        }
      ]
    },
    'Кнопки и управление': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'КАКОЕ УПРАВЛЕНИЕ НЕ РАБОТАЕТ?',
          options: [
            'ФОЛД',
            'ЧЕК / КОЛЛ',
            'СТАВКА / РЕЙЗ',
            'ALL-IN',
            'Ползунок размера ставки',
            'Новая раздача',
            'Сбросить стек',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'ЧТО ПРОИЗОШЛО ПОСЛЕ НАЖАТИЯ?',
          options: [
            'Ничего не произошло',
            'Сработало не то действие',
            'Игра зависла',
            'Сработало с задержкой',
            'Другое'
          ]
        }
      ]
    },
    'Меню и окна': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'КАКОЕ ОКНО ЗАТРОНУТО?',
          options: [
            'Главное меню',
            'Об игре',
            'Последние обновления',
            'Сообщить о баге',
            'Переход к игре',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'ЧТО НЕ РАБОТАЕТ?',
          options: [
            'Не открывается',
            'Не закрывается',
            'Элементы перекрывают друг друга',
            'Текст не помещается',
            'Кнопка не реагирует',
            'Другое'
          ]
        }
      ]
    },
    'Другая проблема': {
      questions: [
        {
          name: 'reportDetail1',
          label: 'НАСколько СИЛЬНО МЕШАЕТ ОШИБКА?',
          options: [
            'Незначительная визуальная ошибка',
            'Мешает играть',
            'Нельзя продолжить раздачу',
            'Игра полностью зависла',
            'Другое'
          ]
        },
        {
          name: 'reportDetail2',
          label: 'НА КАКОМ УСТРОЙСТВЕ ИГРАЕШЬ?',
          options: [
            'Телефон iPhone',
            'Телефон Android',
            'Компьютер Windows',
            'Компьютер Mac',
            'Другое / не уверен'
          ]
        }
      ]
    }
  };

  function renderReportQuestions(category) {
    const container = $('reportDynamicQuestions');
    container.innerHTML = '';

    const config = reportQuestionSets[category];
    if (!config) return;

    config.questions.forEach(question => {
      const label = document.createElement('label');
      label.className = 'report-label';
      label.htmlFor = question.name;
      label.textContent = question.label;

      const select = document.createElement('select');
      select.className = 'report-field';
      select.id = question.name;
      select.name = question.name;
      select.required = true;
      select.style.resize = 'none';
      select.style.cursor = 'pointer';

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = 'Выбери вариант...';
      placeholder.disabled = true;
      placeholder.selected = true;
      select.appendChild(placeholder);

      question.options.forEach(text => {
        const option = document.createElement('option');
        option.value = text;
        option.textContent = text;
        select.appendChild(option);
      });

      container.append(label, select);
    });
  }

  $('reportCategories').addEventListener('change', event => {
    if (event.target.name !== 'category') return;

    renderReportQuestions(event.target.value);
    $('reportStatus').textContent = '';
    $('reportStatus').className = 'report-status';
  });

  $('reportBugButton').addEventListener('click', () => {
    closeOverlays();
    $('reportForm').reset();
    $('reportDynamicQuestions').innerHTML = '';
    $('reportStatus').textContent = '';
    $('reportStatus').className = 'report-status';
    $('reportSubmit').disabled = false;
    $('reportSubmit').textContent = 'ОТПРАВИТЬ ОТЧЁТ';
    $('reportOverlay').classList.add('visible');

    setTimeout(
      () => $('reportCategories').querySelector('input')?.focus(),
      100
    );
  });

  $('reportForm').addEventListener('submit', async event => {
    event.preventDefault();

    const form = $('reportForm');
    const category =
      form.querySelector('input[name="category"]:checked')?.value || '';
    const description = $('reportDescription').value.trim();
    const status = $('reportStatus');
    const submit = $('reportSubmit');

    if (!category) {
      status.className = 'report-status error';
      status.textContent = 'Сначала выбери раздел, где возникла проблема.';
      $('reportCategories').querySelector('input')?.focus();
      return;
    }

    const config = reportQuestionSets[category];
    const details = (config?.questions || [])
      .map(question => {
        const field = $(question.name);
        return field
          ? `${question.label} ${field.value || 'Не указано'}`
          : '';
      })
      .filter(Boolean);

    if (details.some(detail => detail.endsWith('Не указано'))) {
      status.className = 'report-status error';
      status.textContent =
        'Выбери вариант в каждом обязательном списке, чтобы отправить отчёт.';

      (config?.questions || [])
        .map(question => $(question.name))
        .find(field => field && !field.value)
        ?.focus();

      return;
    }

    const fullDescription = [
      `Категория: ${category}`,
      `Описание: ${
        description || 'Не указано — необязательное поле'
      }`,
      ...details
    ].join('\n');

    submit.disabled = true;
    submit.textContent = 'ОТПРАВКА...';
    status.className = 'report-status';
    status.textContent = 'Отправляем отчёт автору...';

    try {
      const payload = {
        description: fullDescription,
        steps: '',
        version: gameVersion
      };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      let result = {};

      try {
        result = await response.json();
      } catch (_) {}

      if (
        !response.ok ||
        result.success === false ||
        result.ok === false
      ) {
        throw new Error(
          result.error ||
          `Не удалось отправить отчёт (HTTP ${response.status}).`
        );
      }

      status.className = 'report-status success';
      status.textContent =
        'Отчёт отправлен. Спасибо! Категория и выбранные варианты приложены к сообщению.';

      form.reset();
      $('reportDynamicQuestions').innerHTML = '';
      submit.textContent = 'ОТПРАВЛЕНО';
    } catch (error) {
      status.className = 'report-status error';
      status.textContent =
        error.message ||
        'Не удалось отправить отчёт. Проверь подключение к интернету и попробуй ещё раз.';

      submit.disabled = false;
      submit.textContent = 'ПОПРОБОВАТЬ СНОВА';
    }
  });
}

