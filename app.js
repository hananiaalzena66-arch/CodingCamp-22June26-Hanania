/* =============================================
   EXPENSE & BUDGET VISUALIZER — app.js
   ============================================= */

'use strict';

// ── Constants ──────────────────────────────────
const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Fun', 'Shopping', 'Bills', 'Health'];

const CAT_META = {
  Food:      { emoji: '🍔', bg: '#d1fae5', color: '#065f46' },
  Transport: { emoji: '🚌', bg: '#dbeafe', color: '#1e40af' },
  Fun:       { emoji: '🎉', bg: '#ede9fe', color: '#5b21b6' },
  Shopping:  { emoji: '🛍️', bg: '#fef3c7', color: '#92400e' },
  Bills:     { emoji: '📄', bg: '#e0f2fe', color: '#0369a1' },
  Health:    { emoji: '💊', bg: '#fce7f3', color: '#9d174d' },
};

const CHART_COLORS = [
  '#10b981','#3b82f6','#f59e0b','#ef4444','#8b5cf6','#06b6d4',
  '#f97316','#84cc16','#ec4899','#14b8a6','#6366f1','#eab308',
];

const LS = {
  TX:   'evb_transactions',
  CATS: 'evb_categories',
  THEME:'evb_theme',
  LIMIT:'evb_limit',
  LIMIT_EN:'evb_limit_enabled',
};

// ── State ──────────────────────────────────────
let transactions = [];
let categories   = [];
let chart        = null;
let spendLimit   = 0;
let limitEnabled = false;

// ── DOM refs ───────────────────────────────────
const els = {
  balanceAmount:  document.getElementById('balanceAmount'),
  incomeTotal:    document.getElementById('incomeTotal'),
  expenseTotal:   document.getElementById('expenseTotal'),

  itemName:       document.getElementById('itemName'),
  amount:         document.getElementById('amount'),
  catSelect:      document.getElementById('catSelect'),
  formError:      document.getElementById('formError'),
  addBtn:         document.getElementById('addBtn'),

  btnIncome:      document.getElementById('btnIncome'),
  btnExpense:     document.getElementById('btnExpense'),

  txList:         document.getElementById('txList'),
  sortSelect:     document.getElementById('sortSelect'),
  limitBanner:    document.getElementById('limitBanner'),

  chartCanvas:    document.getElementById('spendChart'),
  chartLegend:    document.getElementById('chartLegend'),

  themeToggle:    document.getElementById('themeToggle'),

  limitEnabled:   document.getElementById('limitEnabled'),
  limitField:     document.getElementById('limitField'),
  limitInputWrap: document.getElementById('limitInputWrap'),

  newCatInput:    document.getElementById('newCatInput'),
  addCatBtn:      document.getElementById('addCatBtn'),
  catTagsWrap:    document.getElementById('catTagsWrap'),

  monthlySummary: document.getElementById('monthlySummary'),
};

let txType = 'expense'; // 'income' | 'expense'

// ── Persist ────────────────────────────────────
function save() {
  localStorage.setItem(LS.TX,   JSON.stringify(transactions));
  localStorage.setItem(LS.CATS, JSON.stringify(categories));
  localStorage.setItem(LS.LIMIT, spendLimit);
  localStorage.setItem(LS.LIMIT_EN, limitEnabled);
}

function load() {
  try {
    transactions = JSON.parse(localStorage.getItem(LS.TX))  || [];
    categories   = JSON.parse(localStorage.getItem(LS.CATS)) || [...DEFAULT_CATEGORIES];
    spendLimit   = parseFloat(localStorage.getItem(LS.LIMIT)) || 0;
    limitEnabled = localStorage.getItem(LS.LIMIT_EN) === 'true';
  } catch {
    transactions = [];
    categories   = [...DEFAULT_CATEGORIES];
  }

  const theme = localStorage.getItem(LS.THEME) || 'light';
  applyTheme(theme);
}

// ── Theme ──────────────────────────────────────
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  els.themeToggle.textContent = t === 'dark' ? '☀️' : '🌙';
  localStorage.setItem(LS.THEME, t);
  if (chart) updateChart();
}

function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme');
  applyTheme(cur === 'dark' ? 'light' : 'dark');
}

// ── Category meta helper ───────────────────────
function getCatMeta(cat) {
  if (CAT_META[cat]) return CAT_META[cat];
  // Deterministic color for custom cats
  const idx = [...cat].reduce((s, c) => s + c.charCodeAt(0), 0) % CHART_COLORS.length;
  const color = CHART_COLORS[idx];
  return { emoji: '🏷️', bg: color + '22', color };
}

// ── Transaction type toggle ────────────────────
function setType(type) {
  txType = type;
  els.btnIncome.classList.toggle('active-income',   type === 'income');
  els.btnExpense.classList.toggle('active-expense', type === 'expense');
}

// ── Populate category select ───────────────────
function renderCatSelect() {
  const cur = els.catSelect.value;
  els.catSelect.innerHTML = '';
  categories.forEach(c => {
    const o = document.createElement('option');
    o.value = c;
    o.textContent = `${getCatMeta(c).emoji} ${c}`;
    els.catSelect.appendChild(o);
  });
  if (categories.includes(cur)) els.catSelect.value = cur;
}

// ── Add transaction ────────────────────────────
function addTransaction() {
  const name   = els.itemName.value.trim();
  const amount = parseFloat(els.amount.value);
  const cat    = els.catSelect.value;

  if (!name || isNaN(amount) || amount <= 0 || !cat) {
    showError('Please fill in all fields with valid values.');
    return;
  }

  const tx = {
    id:     Date.now().toString(),
    name,
    amount,
    cat,
    type:   txType,
    date:   new Date().toISOString(),
  };

  transactions.unshift(tx);
  save();

  els.itemName.value = '';
  els.amount.value   = '';
  hideError();
  render();
}

function showError(msg) {
  els.formError.textContent = '⚠ ' + msg;
  els.formError.classList.add('show');
}
function hideError() { els.formError.classList.remove('show'); }

// ── Delete transaction ─────────────────────────
function deleteTransaction(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  render();
}

// ── Balance ────────────────────────────────────
function calcTotals() {
  const income  = transactions.filter(t => t.type === 'income').reduce((s,t) => s + t.amount, 0);
  const expense = transactions.filter(t => t.type !== 'income').reduce((s,t) => s + t.amount, 0);
  return { income, expense, balance: income - expense };
}

function fmt(n) {
  return (n < 0 ? '-' : '') + '$' + Math.abs(n).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

function updateBalance() {
  const { income, expense, balance } = calcTotals();
  els.balanceAmount.textContent = fmt(balance);
  els.incomeTotal.textContent   = '+' + fmt(income);
  els.expenseTotal.textContent  = fmt(expense);

  // Limit check
  if (limitEnabled && spendLimit > 0 && expense > spendLimit) {
    els.limitBanner.classList.add('show');
    els.limitBanner.textContent = `⚠️  Spending limit of ${fmt(spendLimit)} exceeded! Total expenses: ${fmt(expense)}`;
  } else {
    els.limitBanner.classList.remove('show');
  }
}

// ── Render transaction list ────────────────────
function getSortedTx() {
  const sort = els.sortSelect.value;
  const arr  = [...transactions];
  if      (sort === 'amount-asc')  arr.sort((a,b) => a.amount - b.amount);
  else if (sort === 'amount-desc') arr.sort((a,b) => b.amount - a.amount);
  else if (sort === 'cat')         arr.sort((a,b) => a.cat.localeCompare(b.cat));
  else                             arr.sort((a,b) => new Date(b.date) - new Date(a.date));
  return arr;
}

function renderList() {
  const { expense } = calcTotals();
  const sorted = getSortedTx();

  if (!sorted.length) {
    els.txList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">💸</div>
        <p>No transactions yet. Add one above!</p>
      </div>`;
    return;
  }

  els.txList.innerHTML = sorted.map(tx => {
    const meta    = getCatMeta(tx.cat);
    const isInc   = tx.type === 'income';
    const sign    = isInc ? '+' : '-';
    const cls     = isInc ? 'income' : 'expense';
    const over    = limitEnabled && spendLimit > 0 && !isInc && tx.amount > spendLimit * 0.5 ? 'over-limit' : '';
    const dateStr = new Date(tx.date).toLocaleDateString('en-US', { month:'short', day:'numeric' });

    return `
      <div class="tx-item ${over}" data-id="${tx.id}">
        <div class="tx-icon" style="background:${meta.bg};">${meta.emoji}</div>
        <div class="tx-info">
          <div class="tx-name">${escHtml(tx.name)}</div>
          <div class="tx-meta">
            <span class="tx-category" style="background:${meta.bg};color:${meta.color};">${tx.cat}</span>
            <span class="tx-date">${dateStr}</span>
          </div>
        </div>
        <span class="tx-amount ${cls}">${sign}${fmt(tx.amount).replace('-','').replace('+','')}</span>
        <button class="btn-delete" onclick="deleteTransaction('${tx.id}')" title="Delete">✕</button>
      </div>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Chart ──────────────────────────────────────
function updateChart() {
  const expenses = transactions.filter(t => t.type !== 'income');
  const byCategory = {};
  expenses.forEach(t => { byCategory[t.cat] = (byCategory[t.cat] || 0) + t.amount; });

  const labels = Object.keys(byCategory);
  const data   = Object.values(byCategory);
  const colors = labels.map((l, i) => CHART_COLORS[i % CHART_COLORS.length]);

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';

  if (chart) {
    chart.data.labels  = labels;
    chart.data.datasets[0].data            = data;
    chart.data.datasets[0].backgroundColor = colors;
    chart.options.plugins.legend.labels.color = isDark ? '#94a3b8' : '#6b7280';
    chart.update();
  } else {
    chart = new Chart(els.chartCanvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: isDark ? '#1a1d23' : '#ffffff',
          hoverOffset: 8,
        }],
      },
      options: {
        cutout: '60%',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: ctx => ` ${ctx.label}: ${fmt(ctx.parsed)}`
            }
          }
        }
      }
    });
  }

  // Legend
  els.chartLegend.innerHTML = labels.length ? labels.map((l, i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i]}"></div>
      ${l}
    </div>`).join('') : '<span style="font-size:.75rem;color:var(--text-muted)">No expense data</span>';
}

// ── Monthly summary ────────────────────────────
function renderMonthlySummary() {
  const byMonth = {};
  transactions.forEach(t => {
    const key = new Date(t.date).toLocaleDateString('en-US', { year:'numeric', month:'short' });
    if (!byMonth[key]) byMonth[key] = { income:0, expense:0, count:0 };
    if (t.type === 'income') byMonth[key].income  += t.amount;
    else                      byMonth[key].expense += t.amount;
    byMonth[key].count++;
  });

  const months = Object.keys(byMonth).slice(0, 6);
  if (!months.length) {
    els.monthlySummary.innerHTML = '<p style="font-size:.75rem;color:var(--text-muted)">No data yet.</p>';
    return;
  }

  els.monthlySummary.innerHTML = `<div class="summary-grid">${months.map(m => {
    const d = byMonth[m];
    const net = d.income - d.expense;
    return `
      <div class="summary-item">
        <div class="summary-month">${m}</div>
        <div class="summary-amount" style="color:${net >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmt(net)}</div>
        <div class="summary-count">${d.count} transaction${d.count !== 1 ? 's' : ''}</div>
      </div>`;
  }).join('')}</div>`;
}

// ── Category management ────────────────────────
function renderCatTags() {
  els.catTagsWrap.innerHTML = categories.map(c => {
    const isDefault = DEFAULT_CATEGORIES.includes(c);
    return `<div class="cat-tag ${isDefault ? 'default' : ''}">
      ${getCatMeta(c).emoji} ${c}
      <button class="remove-cat" onclick="removeCategory('${c}')" title="Remove">✕</button>
    </div>`;
  }).join('');
}

function addCategory() {
  const val = els.newCatInput.value.trim();
  if (!val) return;
  if (categories.map(c=>c.toLowerCase()).includes(val.toLowerCase())) {
    els.newCatInput.value = '';
    return;
  }
  const cat = val.charAt(0).toUpperCase() + val.slice(1);
  categories.push(cat);
  save();
  els.newCatInput.value = '';
  renderCatSelect();
  renderCatTags();
}

function removeCategory(cat) {
  if (DEFAULT_CATEGORIES.includes(cat)) return; // protect defaults
  categories = categories.filter(c => c !== cat);
  save();
  renderCatSelect();
  renderCatTags();
}

// ── Spending limit ─────────────────────────────
function setupLimit() {
  els.limitEnabled.checked = limitEnabled;
  els.limitField.value = spendLimit || '';
  els.limitInputWrap.style.display = limitEnabled ? 'flex' : 'none';

  els.limitEnabled.addEventListener('change', () => {
    limitEnabled = els.limitEnabled.checked;
    els.limitInputWrap.style.display = limitEnabled ? 'flex' : 'none';
    save();
    render();
  });

  els.limitField.addEventListener('input', () => {
    spendLimit = parseFloat(els.limitField.value) || 0;
    save();
    updateBalance();
    renderList();
  });
}

// ── Master render ──────────────────────────────
function render() {
  updateBalance();
  renderList();
  updateChart();
  renderMonthlySummary();
}

// ── Event listeners ────────────────────────────
function bindEvents() {
  els.addBtn.addEventListener('click', addTransaction);

  [els.itemName, els.amount, els.catSelect].forEach(el =>
    el.addEventListener('input', hideError)
  );

  els.itemName.addEventListener('keydown', e => {
    if (e.key === 'Enter') els.amount.focus();
  });
  els.amount.addEventListener('keydown', e => {
    if (e.key === 'Enter') addTransaction();
  });

  els.btnIncome.addEventListener('click',  () => setType('income'));
  els.btnExpense.addEventListener('click', () => setType('expense'));

  els.themeToggle.addEventListener('click', toggleTheme);

  els.sortSelect.addEventListener('change', renderList);

  els.addCatBtn.addEventListener('click', addCategory);
  els.newCatInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') addCategory();
  });
}

// ── Bootstrap ──────────────────────────────────
(function init() {
  load();
  bindEvents();
  setupLimit();
  setType('expense');
  renderCatSelect();
  renderCatTags();
  render();
})();

// Expose globals for inline onclick
window.deleteTransaction = deleteTransaction;
window.removeCategory    = removeCategory;
