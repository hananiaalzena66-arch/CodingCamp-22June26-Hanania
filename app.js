/* =============================================
   EXPENSE & BUDGET VISUALIZER — app.js
   ============================================= */

'use strict';

// ── Categories & Chart Colors (green palette) ──
const CATEGORIES = ['Food', 'Transport', 'Fun', 'Shopping', 'Bills', 'Health'];

const CHART_COLORS = [
  '#2e7d4f', // deep green
  '#52b788', // medium green
  '#95d5b2', // light green
  '#74c69d', // mint green
  '#40916c', // forest green
  '#1b4332', // dark green
  '#b7e4c7', // pale green
  '#d8f3dc', // very light green
];

const LS = {
  EXPENSES:  'evb_expenses',
  THEME:     'evb_theme',
  LIMIT:     'evb_limit',
  LIMIT_EN:  'evb_limit_enabled',
};

// ── State ──────────────────────────────────────
let expenses     = [];
let chart        = null;
let spendLimit   = 0;
let limitEnabled = false;

// ── DOM Refs ───────────────────────────────────
const el = {
  balance:        document.getElementById('balanceAmount'),
  itemName:       document.getElementById('itemName'),
  amount:         document.getElementById('amount'),
  catSelect:      document.getElementById('catSelect'),
  formError:      document.getElementById('formError'),
  addBtn:         document.getElementById('addBtn'),
  txList:         document.getElementById('txList'),
  canvas:         document.getElementById('spendChart'),
  legend:         document.getElementById('chartLegend'),
  themeToggle:    document.getElementById('themeToggle'),
  limitEnabled:   document.getElementById('limitEnabled'),
  limitField:     document.getElementById('limitField'),
  limitInputWrap: document.getElementById('limitInputWrap'),
  limitBanner:    document.getElementById('limitBanner'),
};

// ── Persist ────────────────────────────────────
function save() {
  localStorage.setItem(LS.EXPENSES,  JSON.stringify(expenses));
  localStorage.setItem(LS.LIMIT,     spendLimit);
  localStorage.setItem(LS.LIMIT_EN,  limitEnabled);
}

function load() {
  try {
    expenses = JSON.parse(localStorage.getItem(LS.EXPENSES)) || [];
  } catch {
    expenses = [];
  }
  spendLimit   = parseFloat(localStorage.getItem(LS.LIMIT)) || 0;
  limitEnabled = localStorage.getItem(LS.LIMIT_EN) === 'true';

  // Restore theme
  const theme = localStorage.getItem(LS.THEME) || 'light';
  applyTheme(theme);
}

// ── Theme ──────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  el.themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(LS.THEME, t);
  if (chart) renderChart();
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

// ── Category dropdown ──────────────────────────
function renderCatSelect() {
  el.catSelect.innerHTML = CATEGORIES.map(c =>
    `<option value="${c}">${c}</option>`
  ).join('');
}

// ── Add expense ────────────────────────────────
function addExpense() {
  const name   = el.itemName.value.trim();
  const amount = parseFloat(el.amount.value);
  const cat    = el.catSelect.value;

  if (!name || isNaN(amount) || amount <= 0) {
    showError('Please enter a valid item name and amount.');
    return;
  }

  expenses.unshift({
    id:   Date.now().toString(),
    name,
    amount,
    cat,
    date: new Date().toISOString(),
  });

  save();
  el.itemName.value = '';
  el.amount.value   = '';
  hideError();
  render();
}

// ── Delete expense ─────────────────────────────
function deleteExpense(id) {
  expenses = expenses.filter(e => e.id !== id);
  save();
  render();
}

// ── Error helpers ──────────────────────────────
function showError(msg) {
  el.formError.textContent = msg;
  el.formError.classList.add('show');
}
function hideError() {
  el.formError.classList.remove('show');
}

// ── Format currency ────────────────────────────
function fmt(n) {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ── Update balance & limit banner ─────────────
function updateBalance() {
  const total = expenses.reduce((s, e) => s + e.amount, 0);
  el.balance.textContent = fmt(total);

  if (limitEnabled && spendLimit > 0 && total > spendLimit) {
    el.limitBanner.textContent = `⚠️  Spending limit of ${fmt(spendLimit)} exceeded! Total: ${fmt(total)}`;
    el.limitBanner.classList.add('show');
  } else {
    el.limitBanner.classList.remove('show');
  }
}

// ── Render transaction list ────────────────────
function renderList() {
  if (!expenses.length) {
    el.txList.innerHTML = '<div class="empty-state">No transactions yet. Add one above!</div>';
    return;
  }

  el.txList.innerHTML = expenses.map(e => {
    // Highlight individual item if it alone exceeds 50% of the limit
    const isOver = limitEnabled && spendLimit > 0 && e.amount > spendLimit * 0.5;
    return `
      <div class="tx-item${isOver ? ' over-limit' : ''}">
        <div class="tx-info">
          <div class="tx-name">${escHtml(e.name)}</div>
          <div class="tx-amount">${fmt(e.amount)}</div>
          <span class="tx-category">${e.cat}</span>
        </div>
        <button class="btn-delete" onclick="deleteExpense('${e.id}')">Delete</button>
      </div>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Render chart ───────────────────────────────
function renderChart() {
  const byCategory = {};
  expenses.forEach(e => {
    byCategory[e.cat] = (byCategory[e.cat] || 0) + e.amount;
  });

  const labels = Object.keys(byCategory);
  const data   = Object.values(byCategory);
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const borderCol = isDark ? '#152019' : '#ffffff';

  if (chart) {
    chart.data.labels                       = labels;
    chart.data.datasets[0].data            = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.data.datasets[0].borderColor     = borderCol;
    chart.update();
  } else {
    chart = new Chart(el.canvas, {
      type: 'pie',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: borderCol,
          hoverOffset: 6,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`,
            },
          },
        },
      },
    });
  }

  // Custom legend
  el.legend.innerHTML = labels.length
    ? labels.map((l, i) => `
        <div class="legend-item">
          <div class="legend-dot" style="background:${colors[i]}"></div>
          ${l}
        </div>`).join('')
    : '';
}

// ── Master render ──────────────────────────────
function render() {
  updateBalance();
  renderList();
  renderChart();
}

// ── Spending limit setup ───────────────────────
function setupLimit() {
  el.limitEnabled.checked = limitEnabled;
  el.limitField.value     = spendLimit || '';
  el.limitInputWrap.style.display = limitEnabled ? 'flex' : 'none';

  el.limitEnabled.addEventListener('change', () => {
    limitEnabled = el.limitEnabled.checked;
    el.limitInputWrap.style.display = limitEnabled ? 'flex' : 'none';
    save();
    render();
  });

  el.limitField.addEventListener('input', () => {
    spendLimit = parseFloat(el.limitField.value) || 0;
    save();
    updateBalance();
    renderList();
  });
}

// ── Events ─────────────────────────────────────
el.addBtn.addEventListener('click', addExpense);
el.themeToggle.addEventListener('click', toggleTheme);

el.itemName.addEventListener('keydown', e => {
  if (e.key === 'Enter') el.amount.focus();
});
el.amount.addEventListener('keydown', e => {
  if (e.key === 'Enter') addExpense();
});
[el.itemName, el.amount].forEach(e =>
  e.addEventListener('input', hideError)
);

// ── Init ───────────────────────────────────────
load();
renderCatSelect();
setupLimit();
render();

// Expose for inline onclick
window.deleteExpense = deleteExpense;
