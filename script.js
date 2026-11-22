const STORAGE_KEY = 'water-tracker-app';
const goal = 2000;
const gauge = document.getElementById('gauge');
const percentValue = document.getElementById('percentValue');
const totalValue = document.getElementById('totalValue');
const remainingValue = document.getElementById('remainingValue');
const waterFill = document.getElementById('waterFill');
const customAmount = document.getElementById('customAmount');
const noteInput = document.getElementById('noteInput');
const historyPanel = document.getElementById('historyPanel');
const historyList = document.getElementById('historyList');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const amountMessage = document.getElementById('amountMessage');

const state = {
  entries: []
};

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return formatDateKey(new Date());
}

function getTodayTotal() {
  const todayKey = getTodayKey();
  return state.entries
    .filter((entry) => entry.dateKey === todayKey)
    .reduce((sum, entry) => sum + Number(entry.ml), 0);
}

function clampTotal(total) {
  return Math.max(0, total);
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const entries = Array.isArray(saved.entries) ? saved.entries : [];

    state.entries = entries.filter((entry) => Number.isFinite(Number(entry.ml)) && entry.dateKey);
  } catch (error) {
    state.entries = [];
  }
}

function saveState() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      entries: state.entries.slice(-90)
    })
  );
}

function renderSummary() {
  const total = clampTotal(getTodayTotal());
  const percent = Math.min((total / goal) * 100, 100);
  const remaining = Math.max(goal - total, 0);
  const fillHeight = percent === 0 ? 0 : Math.max(percent, 8);

  totalValue.textContent = `${total} мл`;
  percentValue.textContent = `${Math.round(percent)}%`;
  gauge.setAttribute('aria-label', `${Math.round(percent)} відсотків`);
  gauge.style.background = `conic-gradient(#9dc0f4 0deg ${percent * 3.6}deg, var(--gauge-empty) ${percent * 3.6}deg 360deg)`;
  waterFill.style.height = `${fillHeight}%`;

  if (remaining === 0) {
    remainingValue.textContent = 'Мета досягнута!';
  } else {
    remainingValue.textContent = `Залишилось: ${(remaining / 1000).toFixed(1).replace(/\.0$/, '')} л`;
  }
}

function renderHistory() {
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - index);

    const key = formatDateKey(date);
    const dayTotal = clampTotal(state.entries
      .filter((entry) => entry.dateKey === key)
      .reduce((sum, entry) => sum + Number(entry.ml), 0));

    const label = index === 0 ? 'Сьогодні' : index === 1 ? 'Вчора' : date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    days.push({ label, total: dayTotal });
  }

  historyList.innerHTML = state.entries
    .slice()
    .reverse()
    .slice(0, 8)
    .map((entry) => {
      const isPositive = Number(entry.ml) > 0;
      const sign = isPositive ? '+' : '−';
      const amount = `${sign}${Math.abs(Number(entry.ml))} мл`;
      const note = entry.note ? ` · ${entry.note}` : '';
      const time = new Date(entry.timestamp).toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });

      return `
        <li>
          <div class="entry-meta">
            <span>${time}</span>
            <span>${entry.type === 'add' ? 'Поповнення' : 'Видалення'}${note}</span>
          </div>
          <span class="entry-amount ${isPositive ? 'positive' : 'negative'}">${amount}</span>
        </li>
      `;
    })
    .join('') || '<li><span>Історія порожня</span></li>';

  if (historyPanel && historyPanel.scrollIntoView) {
    historyPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
}

function addWater(ml, note = '', type = 'add') {
  const amount = Number(ml);

  if (!Number.isFinite(amount) || amount <= 0) {
    return;
  }

  const signedAmount = type === 'remove' ? -amount : amount;

  state.entries.push({
    ml: signedAmount,
    note,
    type,
    timestamp: new Date().toISOString(),
    dateKey: formatDateKey(new Date())
  });

  saveState();
  renderSummary();
  renderHistory();
}

function showAmountMessage(message, type = 'error') {
  amountMessage.textContent = message;
  amountMessage.className = `amount-message ${type}`;
  customAmount.setAttribute('aria-invalid', type === 'error' ? 'true' : 'false');
}

function clearAmountMessage() {
  amountMessage.textContent = '';
  amountMessage.className = 'amount-message';
  customAmount.setAttribute('aria-invalid', 'false');
}

function handleCustomAction(type) {
  const amount = Number(customAmount.value);
  const note = noteInput.value.trim();

  if (customAmount.value.trim() === '' || !Number.isFinite(amount)) {
    showAmountMessage('Введіть обʼєм у мілілітрах.');
    customAmount.focus();
    return;
  }

  if (amount <= 0) {
    showAmountMessage('Обʼєм не може бути відʼємним або дорівнювати нулю.');
    customAmount.focus();
    return;
  }

  if (amount < 50) {
    showAmountMessage('Мінімальний обʼєм — 50 мл.');
    customAmount.focus();
    return;
  }

  if (amount > 5000) {
    showAmountMessage('Максимальний обʼєм — 5000 мл.');
    customAmount.focus();
    return;
  }

  let finalAmount = amount;

  if (type === 'remove') {
    const todayTotal = clampTotal(getTodayTotal());

    if (todayTotal <= 0) {
      showAmountMessage('Сьогодні немає води для видалення.');
      customAmount.focus();
      return;
    }

    finalAmount = Math.min(amount, todayTotal);
    customAmount.value = finalAmount;
  }

  addWater(finalAmount, note, type);
  customAmount.value = Math.min(Math.max(finalAmount, 50), 5000);
  noteInput.value = '';
  showAmountMessage(
    type === 'remove' ? `Видалено ${finalAmount} мл.` : `Додано ${finalAmount} мл.`,
    'success'
  );
  customAmount.focus();
}

function clearHistory() {
  state.entries = [];
  saveState();
  renderSummary();
  renderHistory();
}

function bindEvents() {
  document.querySelectorAll('.quick-btn').forEach((button) => {
    button.addEventListener('click', () => {
      const amount = Number(button.dataset.volume);
      const note = noteInput.value.trim();
      addWater(amount, note, 'add');
      noteInput.value = '';
    });
  });

  document.getElementById('addCustomBtn').addEventListener('click', () => handleCustomAction('add'));
  document.getElementById('removeCustomBtn').addEventListener('click', () => handleCustomAction('remove'));

  customAmount.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      handleCustomAction('add');
    }
  });

  customAmount.addEventListener('input', clearAmountMessage);

  clearHistoryBtn.addEventListener('click', clearHistory);
}

loadState();
bindEvents();
renderSummary();
renderHistory();

const themeBtn = document.getElementById('themeBtn');
const THEME_KEY = 'water-theme';

function applyTheme(isDark) {
  document.documentElement.classList.toggle('dark', isDark);
  themeBtn.textContent = isDark ? '☀️' : '🌙';
}

applyTheme(localStorage.getItem(THEME_KEY) === 'dark');

themeBtn.addEventListener('click', () => {
  const isDark = !document.documentElement.classList.contains('dark');
  applyTheme(isDark);
  localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
});