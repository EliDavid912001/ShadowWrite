/**
 * Truth or Dare — bottle spin + no-repeat decks (100/100)
 * Requires: truth-dare-decks.js (window.TOD_DECKS)
 */
(function () {
  'use strict';

  var SPIN_MS = 3500;

  function fisherYatesShuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function getDecks() {
    var d = window.TOD_DECKS;
    if (!d || !d.truths || !d.dares) return null;
    return d;
  }

  window.initTruthOrDare = function (root) {
    if (!root) return;

    var source = getDecks();
    if (!source) {
      root.innerHTML = '<p class="tod-error">חסרים קלפים — טען מחדש את הדף.</p>';
      return;
    }

    var players = [];
    var truths = fisherYatesShuffle(source.truths);
    var dares = fisherYatesShuffle(source.dares);
    var currentRotation = 0;
    var isSpinning = false;
    var activePlayer = null;

    root.innerHTML =
      '<div class="tod-container container">' +
      '<h1 class="tod-brand">DARK SCRIPT</h1>' +
      '<p class="tod-subtitle">אמת או חובה - אל תהיו כבדים</p>' +
      '<div id="setup-screen" class="tod-setup-screen">' +
      '<div class="tod-input-group">' +
      '<input type="text" id="player-input" placeholder="הכנס שם שחקן..." maxlength="24" autocomplete="off" />' +
      '<button type="button" class="tod-add-btn tod-btn-3d" id="todAddBtn">הוסף</button>' +
      '</div>' +
      '<div class="tod-players-wrap" id="players-list"></div>' +
      '<p class="tod-setup-hint" id="setup-hint">הוסף לפחות 2 שחקנים</p>' +
      '<button type="button" class="tod-start-btn tod-btn-3d" id="start-btn">סובב ת\'בקבוק! 🍾</button>' +
      '</div>' +
      '<div id="game-screen" class="tod-game-screen hidden">' +
      '<div class="tod-turn-header" id="turn-display">מי הבא?</div>' +
      '<div class="tod-bottle-container" id="bottle-container" role="button" tabindex="0" aria-label="סובב בקבוק">' +
      '<svg class="tod-bottle" id="bottle-svg" viewBox="0 0 100 300" width="80" height="200" aria-hidden="true">' +
      '<path d="M40 0 H60 V80 L80 120 V280 C80 290 70 300 50 300 C30 300 20 290 20 280 V120 L40 80 Z" fill="#2E7D32"/>' +
      '<rect x="42" y="0" width="16" height="20" fill="#FBC02D"/>' +
      '<rect x="25" y="150" width="50" height="70" fill="#ffffff" opacity="0.9"/>' +
      '<text x="50" y="195" font-family="Arial" font-size="16" font-weight="bold" fill="#000" text-anchor="middle" transform="rotate(-90 50 195)">TRUTH/DARE</text>' +
      '</svg></div>' +
      '<p class="tod-spin-hint" id="spin-hint">לחץ על הבקבוק כדי לסובב</p>' +
      '<div class="tod-deck-counts" id="deck-counts"></div>' +
      '<div class="tod-action-buttons" id="action-buttons">' +
      '<button type="button" class="tod-action-btn tod-truth-btn tod-btn-3d" id="truth-btn">אמת 😇</button>' +
      '<button type="button" class="tod-action-btn tod-dare-btn tod-btn-3d" id="dare-btn">חובה 😈</button>' +
      '</div>' +
      '<div class="tod-result-box result-box" id="result-box"></div>' +
      '<button type="button" class="tod-next-turn-btn tod-btn-3d" id="next-turn-btn">תור הבא ➡️</button>' +
      '<button type="button" class="tod-back-setup" id="back-setup">← חזרה להגדרות</button>' +
      '</div>' +
      '</div>';

    var setupScreen = root.querySelector('#setup-screen');
    var gameScreen = root.querySelector('#game-screen');
    var playerInput = root.querySelector('#player-input');
    var addBtn = root.querySelector('#todAddBtn');
    var playersList = root.querySelector('#players-list');
    var setupHint = root.querySelector('#setup-hint');
    var startBtn = root.querySelector('#start-btn');
    var turnDisplay = root.querySelector('#turn-display');
    var bottleContainer = root.querySelector('#bottle-container');
    var bottleSvg = root.querySelector('#bottle-svg');
    var spinHint = root.querySelector('#spin-hint');
    var deckCounts = root.querySelector('#deck-counts');
    var actionButtons = root.querySelector('#action-buttons');
    var truthBtn = root.querySelector('#truth-btn');
    var dareBtn = root.querySelector('#dare-btn');
    var resultBox = root.querySelector('#result-box');
    var nextTurnBtn = root.querySelector('#next-turn-btn');
    var backSetupBtn = root.querySelector('#back-setup');

    function updateDeckCounts() {
      deckCounts.textContent =
        'נשארו: ' + truths.length + ' אמת · ' + dares.length + ' חובה';
    }

    function renderPlayers() {
      playersList.innerHTML = players
        .map(function (name, i) {
          return (
            '<div class="tod-player-tag">' +
            escapeHtml(name) +
            ' <span class="tod-tag-remove" data-i="' + i + '" role="button" tabindex="0">✖</span></div>'
          );
        })
        .join('');

      playersList.querySelectorAll('.tod-tag-remove').forEach(function (el) {
        function remove() {
          var idx = parseInt(el.getAttribute('data-i'), 10);
          players.splice(idx, 1);
          renderPlayers();
        }
        el.onclick = remove;
        el.onkeydown = function (e) {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            remove();
          }
        };
      });

      var canStart = players.length >= 2;
      startBtn.classList.toggle('visible', canStart);
      setupHint.textContent = canStart
        ? players.length + ' שחקנים — מוכן להתחיל!'
        : 'הוסף לפחות 2 שחקנים';
    }

    function hideGamePanels() {
      actionButtons.classList.remove('visible');
      resultBox.classList.remove('visible');
      nextTurnBtn.classList.remove('visible');
    }

    function startGame() {
      if (players.length < 2) return;
      setupScreen.classList.add('hidden');
      gameScreen.classList.remove('hidden');
      activePlayer = null;
      hideGamePanels();
      turnDisplay.innerHTML = 'מי הבא?';
      spinHint.classList.remove('hidden');
      spinHint.style.display = 'block';
      updateDeckCounts();
    }

    function spinBottle() {
      if (isSpinning || players.length < 2) return;
      isSpinning = true;
      hideGamePanels();
      spinHint.style.display = 'none';
      turnDisplay.textContent = 'מסתובב...';

      var extraSpins = (Math.floor(Math.random() * 5) + 5) * 360;
      var randomAngle = Math.floor(Math.random() * 360);
      currentRotation += extraSpins + randomAngle;
      bottleSvg.style.transform = 'rotate(' + currentRotation + 'deg)';

      setTimeout(function () {
        activePlayer = players[Math.floor(Math.random() * players.length)];
        turnDisplay.innerHTML =
          'התור של:<br><span class="tod-turn-name">' +
          escapeHtml(activePlayer) +
          '</span>';
        actionButtons.classList.add('visible');
        isSpinning = false;
      }, SPIN_MS);
    }

    function pickCard(type) {
      if (!activePlayer || isSpinning) return;
      actionButtons.classList.remove('visible');

      var arr = type === 'truth' ? truths : dares;
      var title = type === 'truth' ? 'אמת 😇:' : 'חובה 😈:';
      var html;

      if (!arr.length) {
        html =
          '<strong>' +
          title +
          '</strong><br>נגמרו הכרטיסיות! לחץ "תור הבא" לסיבוב חדש או חזור להגדרות.';
      } else {
        var card = arr.pop();
        html = '<strong>' + title + '</strong><br>' + escapeHtml(card);
      }

      resultBox.innerHTML = html;
      resultBox.classList.add('visible');
      resultBox.classList.toggle('truth-result', type === 'truth');
      resultBox.classList.toggle('dare-result', type === 'dare');
      nextTurnBtn.classList.add('visible');
      updateDeckCounts();
    }

    function resetTurn() {
      resultBox.classList.remove('visible', 'truth-result', 'dare-result');
      nextTurnBtn.classList.remove('visible');
      actionButtons.classList.remove('visible');
      activePlayer = null;
      turnDisplay.innerHTML = 'מי הבא?';
      spinHint.style.display = 'block';
      spinHint.classList.remove('hidden');
    }

    function addPlayer() {
      var name = playerInput.value.trim();
      if (!name) return;
      if (players.indexOf(name) >= 0) {
        setupHint.textContent = 'השם כבר קיים';
        setupHint.classList.add('err');
        return;
      }
      players.push(name);
      playerInput.value = '';
      setupHint.classList.remove('err');
      renderPlayers();
      playerInput.focus();
    }

    function backToSetup() {
      gameScreen.classList.add('hidden');
      setupScreen.classList.remove('hidden');
      resetTurn();
      isSpinning = false;
    }

    addBtn.onclick = addPlayer;
    playerInput.onkeydown = function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        addPlayer();
      }
    };
    startBtn.onclick = startGame;
    bottleContainer.onclick = spinBottle;
    bottleContainer.onkeydown = function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        spinBottle();
      }
    };
    truthBtn.onclick = function () { pickCard('truth'); };
    dareBtn.onclick = function () { pickCard('dare'); };
    nextTurnBtn.onclick = resetTurn;
    backSetupBtn.onclick = backToSetup;

    renderPlayers();
    updateDeckCounts();
  };
})();
