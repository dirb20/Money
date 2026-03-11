/* Storage & State Manager */
let savedAccounts = null;
let savedTransactions = null;
try {
    const rawAcc = localStorage.getItem('wavepay_accounts');
    const rawTx = localStorage.getItem('wavepay_transactions');
    if (rawAcc) savedAccounts = JSON.parse(rawAcc);
    if (rawTx) savedTransactions = JSON.parse(rawTx);
} catch (e) {
    console.warn('LocalStorage error:', e);
}

let state = {
    viewMode: 'month', // 'month', 'year', 'period'
    viewDate: new Date(),
    periodStart: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`; })(),
    periodEnd: (() => { const d = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })(),
    filter: { type: 'all', category: 'all' },
    accounts: (savedAccounts && savedAccounts.length > 0) ? savedAccounts : [
        { id: '1', name: '預設現金帳戶', balance: 0 }
    ],
    transactions: savedTransactions || [
        // 預設給予跟照片一樣的假資料以便預覽
        { id: 't1', accountId: '1', type: 'expense', category: '交通', amount: 10800, date: new Date().toISOString() },
        { id: 't2', accountId: '1', type: 'expense', category: '生活', amount: 4540, date: new Date().toISOString() },
        { id: 't3', accountId: '1', type: 'expense', category: '食物', amount: 716, date: new Date().toISOString() },
        { id: 't4', accountId: '1', type: 'expense', category: '水電', amount: 298, date: new Date().toISOString() }
    ],
    currentAccountId: '1'
};

if (!state.accounts.find(a => a.id === state.currentAccountId)) {
    state.currentAccountId = state.accounts[0].id;
}

function saveData() {
    try {
        localStorage.setItem('wavepay_accounts', JSON.stringify(state.accounts));
        localStorage.setItem('wavepay_transactions', JSON.stringify(state.transactions));
    } catch (e) {
        console.warn('LocalStorage save error:', e);
    }
}

// Global chart instance
let expenseChart = null;

// Color Mapping
const categoryColors = {
    '交通': '#3b82f6', // 藍
    '生活': '#ef4444', // 紅
    '食物': '#f59e0b', // 橘
    '水電': '#fce354', // 黃
    '奉獻': '#a4c639', // 綠
    '薪水': '#10b981', // 收入綠
    '其他': '#9ca3af'  // 灰
};

function getColor(cat) {
    return categoryColors[cat] || categoryColors['其他'];
}

/* Form Helper */
function formatNumber(num) {
    return num.toLocaleString();
}

/* Main Flow */
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    renderApp();
});

function setupEventListeners() {
    const fabAdd = document.getElementById('fab-add');
    const manageAccountsBtn = document.getElementById('manage-accounts-btn');

    // Filter features
    const filterBtn = document.getElementById('filter-btn');
    const filterModal = document.getElementById('filter-modal');
    const closeFilterModalBtn = document.getElementById('close-filter-modal');
    const applyFilterBtn = document.getElementById('apply-filter-btn');
    const filterType = document.getElementById('filter-type');
    const filterCat = document.getElementById('filter-cat');

    filterBtn.addEventListener('click', () => {
        filterType.value = state.filter.type;
        filterCat.value = state.filter.category;
        filterModal.classList.remove('hidden');
    });

    closeFilterModalBtn.addEventListener('click', () => filterModal.classList.add('hidden'));

    applyFilterBtn.addEventListener('click', () => {
        state.filter.type = filterType.value;
        state.filter.category = filterCat.value;
        filterModal.classList.add('hidden');
        renderApp();
    });

    // View Mode Toggle
    const modeBtns = document.querySelectorAll('.segmented-control button');
    modeBtns.forEach((btn, index) => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (index === 0) state.viewMode = 'month';
            if (index === 1) state.viewMode = 'year';
            if (index === 2) state.viewMode = 'period';
            renderApp();
        });
    });

    // Date Picker Modal
    const datePickerModal = document.getElementById('date-picker-modal');
    const closeDatePickerBtn = document.getElementById('close-date-picker-modal');
    const applyDateBtn = document.getElementById('apply-date-btn');

    document.getElementById('current-month-text').addEventListener('click', () => {
        document.getElementById('dp-month-view').classList.add('hidden');
        document.getElementById('dp-year-view').classList.add('hidden');
        document.getElementById('dp-period-view').classList.add('hidden');

        if (state.viewMode === 'month') {
            document.getElementById('dp-month-view').classList.remove('hidden');
            document.getElementById('date-picker-title').innerText = '選擇月份';
            const m = String(state.viewDate.getMonth() + 1).padStart(2, '0');
            document.getElementById('dp-month-input').value = `${state.viewDate.getFullYear()}-${m}`;
        } else if (state.viewMode === 'year') {
            document.getElementById('dp-year-view').classList.remove('hidden');
            document.getElementById('date-picker-title').innerText = '選擇年份';
            document.getElementById('dp-year-input').value = state.viewDate.getFullYear();
        } else if (state.viewMode === 'period') {
            document.getElementById('dp-period-view').classList.remove('hidden');
            document.getElementById('date-picker-title').innerText = '選擇期間';
            document.getElementById('dp-start-input').value = state.periodStart;
            document.getElementById('dp-end-input').value = state.periodEnd;
        }
        datePickerModal.classList.remove('hidden');
    });

    closeDatePickerBtn.addEventListener('click', () => {
        datePickerModal.classList.add('hidden');
    });

    applyDateBtn.addEventListener('click', () => {
        if (state.viewMode === 'month') {
            const val = document.getElementById('dp-month-input').value;
            if (val) {
                const parts = val.split('-');
                state.viewDate.setFullYear(parseInt(parts[0]), parseInt(parts[1]) - 1, 1);
            }
        } else if (state.viewMode === 'year') {
            const val = document.getElementById('dp-year-input').value;
            if (val) {
                state.viewDate.setFullYear(parseInt(val));
            }
        } else if (state.viewMode === 'period') {
            state.periodStart = document.getElementById('dp-start-input').value;
            state.periodEnd = document.getElementById('dp-end-input').value;
        }
        datePickerModal.classList.add('hidden');
        renderApp();
    });

    // Date changes
    const prevMonthBtn = document.getElementById('prev-month-btn');
    const nextMonthBtn = document.getElementById('next-month-btn');

    prevMonthBtn.addEventListener('click', () => {
        if (state.viewMode === 'month') {
            state.viewDate.setMonth(state.viewDate.getMonth() - 1);
        } else if (state.viewMode === 'year') {
            state.viewDate.setFullYear(state.viewDate.getFullYear() - 1);
        }
        renderApp();
    });

    nextMonthBtn.addEventListener('click', () => {
        if (state.viewMode === 'month') {
            state.viewDate.setMonth(state.viewDate.getMonth() + 1);
        } else if (state.viewMode === 'year') {
            state.viewDate.setFullYear(state.viewDate.getFullYear() + 1);
        }
        renderApp();
    });

    // Item Action click
    document.getElementById('table-body').addEventListener('click', (e) => {
        const actionIcon = e.target.closest('.action-dots');
        if (actionIcon) {
            const cat = actionIcon.dataset.cat;
            const type = actionIcon.dataset.type;
            openCatTxModal(cat, type);
        }
    });

    const catTxModal = document.getElementById('cat-tx-modal');
    document.getElementById('close-cat-tx-modal').addEventListener('click', () => catTxModal.classList.add('hidden'));

    document.getElementById('cat-tx-list').addEventListener('click', (e) => {
        const delBtn = e.target.closest('.del-tx-btn');
        const editBtn = e.target.closest('.edit-tx-btn');

        if (delBtn) {
            const id = delBtn.dataset.id;
            if (confirm('確定要刪除這筆紀錄嗎？')) {
                state.transactions = state.transactions.filter(t => t.id !== id);
                saveData();
                renderApp();
                // 重新刷新明細 Modal
                const cat = document.getElementById('cat-tx-list').dataset.currentCat;
                const type = document.getElementById('cat-tx-list').dataset.currentType;
                openCatTxModal(cat, type);
            }
        } else if (editBtn) {
            const id = editBtn.dataset.id;
            const tx = state.transactions.find(t => t.id === id);
            if (tx) {
                editingTxId = id;
                document.getElementById('save-tx-btn').innerText = '儲存修改';
                document.querySelector('#transaction-modal h3').innerText = '修改紀錄';

                currentTxType = tx.type;
                typeBtns.forEach(b => {
                    b.classList.remove('active');
                    if (b.dataset.type === tx.type) b.classList.add('active');
                });

                txAmount.value = tx.amount;
                txCategory.value = tx.category || '其他';
                txDesc.value = tx.desc || '';

                if (tx.date) {
                    const d = new Date(tx.date);
                    const parsedDateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                    document.getElementById('tx-date').value = parsedDateStr;
                } else {
                    document.getElementById('tx-date').value = '';
                }

                catTxModal.classList.add('hidden');
                txModal.classList.remove('hidden');
            }
        }
    });

    // Modals
    const accountModal = document.getElementById('account-modal');
    const txModal = document.getElementById('transaction-modal');

    const closeAccModalBtn = document.getElementById('close-acc-modal');
    const closeTxModalBtn = document.getElementById('close-tx-modal');

    // Add Tx
    let currentTxType = 'expense';
    const typeBtns = document.querySelectorAll('.type-btn');
    typeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            typeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentTxType = btn.dataset.type;
        });
    });

    const txAmount = document.getElementById('tx-amount');
    const txCategory = document.getElementById('tx-category');
    const txDesc = document.getElementById('tx-desc');
    const txDate = document.getElementById('tx-date');
    const saveTxBtn = document.getElementById('save-tx-btn');

    let editingTxId = null;

    // Add Account
    const newAccName = document.getElementById('new-acc-name');
    const addAccBtn = document.getElementById('add-acc-btn');
    const accSelect = document.getElementById('acc-select');

    // Toggle logic
    const showAddModal = () => {
        editingTxId = null;
        document.getElementById('save-tx-btn').innerText = '新增至帳簿';
        document.querySelector('#transaction-modal h3').innerText = '新增紀錄';
        txAmount.value = '';
        txDesc.value = '';
        currentTxType = 'expense';
        typeBtns.forEach(b => {
            b.classList.remove('active');
            if (b.dataset.type === 'expense') b.classList.add('active');
        });

        // 設定預設日期為本月或目前查看的月份
        let targetD = new Date();
        if (targetD.getFullYear() !== state.viewDate.getFullYear() || targetD.getMonth() !== state.viewDate.getMonth()) {
            targetD = new Date(state.viewDate.getFullYear(), state.viewDate.getMonth(), 1);
        }
        txDate.value = `${targetD.getFullYear()}-${String(targetD.getMonth() + 1).padStart(2, '0')}-${String(targetD.getDate()).padStart(2, '0')}`;

        txModal.classList.remove('hidden');
    };
    fabAdd.addEventListener('click', showAddModal);
    document.getElementById('nav-add-btn').addEventListener('click', showAddModal);
    closeTxModalBtn.addEventListener('click', () => {
        txModal.classList.add('hidden');
    });

    manageAccountsBtn.addEventListener('click', () => {
        accountModal.classList.remove('hidden');
    });
    closeAccModalBtn.addEventListener('click', () => {
        accountModal.classList.add('hidden');
    });

    // Handle Transactions save
    saveTxBtn.addEventListener('click', () => {
        const amt = parseFloat(txAmount.value);
        if (amt > 0) {
            let saveDateISO;
            if (txDate.value) {
                const parts = txDate.value.split('-');
                const localD = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
                saveDateISO = localD.toISOString();
            } else {
                saveDateISO = new Date().toISOString();
            }

            if (editingTxId) {
                const tx = state.transactions.find(t => t.id === editingTxId);
                if (tx) {
                    tx.type = currentTxType;
                    tx.category = txCategory.value;
                    tx.desc = txDesc.value.trim();
                    tx.amount = amt;
                    tx.date = saveDateISO;
                }
                editingTxId = null;
            } else {
                const tx = {
                    id: Date.now().toString(),
                    accountId: state.currentAccountId,
                    type: currentTxType,
                    category: txCategory.value,
                    desc: txDesc.value.trim(),
                    amount: amt,
                    date: saveDateISO
                };
                state.transactions.push(tx);
            }
            saveData();
            renderApp();

            // reset form
            txAmount.value = '';
            txDesc.value = '';
            txModal.classList.add('hidden');
        } else {
            alert("請輸入正確的金額");
        }
    });

    // Handle Account settings
    accSelect.addEventListener('change', (e) => {
        state.currentAccountId = e.target.value;
        renderApp();
    });

    addAccBtn.addEventListener('click', () => {
        const name = newAccName.value.trim();
        if (name) {
            const newAcc = {
                id: Date.now().toString(),
                name: name,
                balance: 0
            };
            state.accounts.push(newAcc);
            state.currentAccountId = newAcc.id; // auto-switch
            saveData();
            renderApp();
            newAccName.value = '';
            accountModal.classList.add('hidden');
        } else {
            alert("請輸入帳戶名稱");
        }
    });

    // Bottom Nav Tabs switch
    const bottomNavItems = document.querySelectorAll('.bottom-nav .nav-item[data-tab]');
    const pages = document.querySelectorAll('.page-view');

    bottomNavItems.forEach(item => {
        item.addEventListener('click', () => {
            const tab = item.dataset.tab;

            bottomNavItems.forEach(nav => nav.classList.remove('active'));
            item.classList.add('active');

            pages.forEach(p => p.classList.add('hidden'));

            if (tab === 'ledger') {
                document.getElementById('view-main').classList.remove('hidden');
                document.body.classList.add('mode-ledger');
            } else if (tab === 'chart') {
                document.getElementById('view-main').classList.remove('hidden');
                document.body.classList.remove('mode-ledger');
            } else if (tab === 'accounts') {
                document.getElementById('view-accounts').classList.remove('hidden');
            } else if (tab === 'settings') {
                document.getElementById('view-settings').classList.remove('hidden');
            }
        });
    });

    // Page-level Add account
    const pageAddAccBtn = document.getElementById('page-add-acc-btn');
    if (pageAddAccBtn) {
        pageAddAccBtn.addEventListener('click', () => {
            const name = document.getElementById('page-new-acc-name').value.trim();
            if (name) {
                const newAcc = { id: Date.now().toString(), name: name, balance: 0 };
                state.accounts.push(newAcc);
                state.currentAccountId = newAcc.id;
                saveData();
                renderApp();
                document.getElementById('page-new-acc-name').value = '';
            } else {
                alert("請輸入帳戶名稱");
            }
        });
    }
}

function renderAccounts() {
    const accSelect = document.getElementById('acc-select');
    accSelect.innerHTML = '';

    const pageAccList = document.getElementById('accounts-page-list');
    if (pageAccList) pageAccList.innerHTML = '';

    state.accounts.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = acc.name;
        if (acc.id === state.currentAccountId) opt.selected = true;
        accSelect.appendChild(opt);

        if (pageAccList) {
            const div = document.createElement('div');
            div.style.cssText = `padding: 16px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; background: ${acc.id === state.currentAccountId ? '#eff6ff' : '#fff'}; cursor: pointer; border: 1px solid ${acc.id === state.currentAccountId ? '#bfdbfe' : '#eee'}; border-left: ${acc.id === state.currentAccountId ? '4px solid #3b82f6' : '1px solid #eee'}`;

            let balance = 0;
            state.transactions.filter(t => t.accountId === acc.id).forEach(t => {
                balance += (t.type === 'income' ? t.amount : -t.amount);
            });

            div.innerHTML = `
                <div>
                    <div style="font-size: 16px; font-weight: 500; color: #333;">${acc.name}</div>
                    ${acc.id === state.currentAccountId ? '<div style="font-size: 12px; color: #3b82f6; margin-top: 4px;"><i class="fa-solid fa-check"></i> 目前使用中</div>' : ''}
                </div>
                <div style="font-size: 18px; font-weight: bold; color: ${balance >= 0 ? '#10b981' : '#ef4444'};">${formatNumber(balance)}</div>
            `;
            div.addEventListener('click', () => {
                state.currentAccountId = acc.id;
                renderApp();
            });
            pageAccList.appendChild(div);
        }
    });
}

function renderApp() {
    renderAccounts();

    // 更新日期顯示
    const dateSelector = document.querySelector('.date-selector');
    const dateSpan = document.querySelector('#current-month-text span');

    const prevBtn = document.getElementById('prev-month-btn');
    const nextBtn = document.getElementById('next-month-btn');

    if (state.viewMode === 'month') {
        dateSelector.style.display = 'flex';
        prevBtn.style.visibility = 'visible';
        nextBtn.style.visibility = 'visible';
        if (dateSpan) dateSpan.innerText = `${state.viewDate.getFullYear()}年${state.viewDate.getMonth() + 1}月`;
    } else if (state.viewMode === 'year') {
        dateSelector.style.display = 'flex';
        prevBtn.style.visibility = 'visible';
        nextBtn.style.visibility = 'visible';
        if (dateSpan) dateSpan.innerText = `${state.viewDate.getFullYear()}年`;
    } else {
        dateSelector.style.display = 'flex'; // 保留列顯示，才可以點去編輯
        prevBtn.style.visibility = 'hidden';
        nextBtn.style.visibility = 'hidden';
        if (dateSpan) dateSpan.innerText = `${state.periodStart.replace(/-/g, '/')} ~ ${state.periodEnd.replace(/-/g, '/')}`;
    }

    const targetYear = state.viewDate.getFullYear();
    const targetMonth = state.viewDate.getMonth();

    const accTx = state.transactions.filter(t => {
        if (t.accountId !== state.currentAccountId) return false;
        if (!t.date) return false;

        const d = new Date(t.date);

        // Date Check
        if (state.viewMode === 'month') {
            if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonth) return false;
        } else if (state.viewMode === 'year') {
            if (d.getFullYear() !== targetYear) return false;
        } else if (state.viewMode === 'period') {
            const txDateStr = t.date.split('T')[0];
            if (state.periodStart && txDateStr < state.periodStart) return false;
            if (state.periodEnd && txDateStr > state.periodEnd) return false;
        }

        // Category Filter Check
        if (state.filter.type !== 'all' && t.type !== state.filter.type) return false;
        if (state.filter.category !== 'all' && (t.category || '其他') !== state.filter.category) return false;

        return true;
    });

    let totalExpense = 0;

    let expenseGroup = {};
    let incomeGroup = {};

    accTx.forEach(t => {
        let cat = t.category || '其他';
        let desc = t.desc ? ` (${t.desc})` : ''; // Include desc in table

        if (t.type === 'expense') {
            totalExpense += t.amount;
            if (!expenseGroup[cat]) expenseGroup[cat] = 0;
            expenseGroup[cat] += t.amount;
        } else {
            let label = cat + desc;
            if (!incomeGroup[label]) incomeGroup[label] = 0;
            incomeGroup[label] += t.amount;
        }
    });

    let chartData = Object.keys(expenseGroup).map(cat => ({
        rawCategory: cat,
        isIncome: false,
        category: cat,
        amount: expenseGroup[cat],
        ratio: totalExpense > 0 ? (expenseGroup[cat] / totalExpense) * 100 : 0,
        color: getColor(cat)
    })).sort((a, b) => b.amount - a.amount);

    let incomeData = Object.keys(incomeGroup).map(cat => ({
        rawCategory: cat,
        isIncome: true,
        category: '收入 - ' + cat,
        amount: incomeGroup[cat],
        ratio: 0,
        color: categoryColors['薪水']
    })).sort((a, b) => b.amount - a.amount);

    renderChart(chartData);

    let tableData = [...chartData, ...incomeData];
    renderTable(tableData);

    // Update summary text
    const summarySpans = document.querySelectorAll('.summary-item span');
    if (summarySpans.length >= 2) {
        summarySpans[0].innerText = formatNumber(totalExpense);

        // 取得該範圍總天數來計算平均
        let daysInRange = 30; // default for period
        if (state.viewMode === 'month') {
            daysInRange = new Date(targetYear, targetMonth + 1, 0).getDate();
        } else if (state.viewMode === 'year') {
            const isLeapYear = (targetYear % 4 === 0 && targetYear % 100 !== 0) || (targetYear % 400 === 0);
            daysInRange = isLeapYear ? 366 : 365;
        } else {
            if (state.periodStart && state.periodEnd) {
                const s = new Date(state.periodStart);
                const e = new Date(state.periodEnd);
                let diff = Math.ceil((e - s) / (1000 * 60 * 60 * 24)) + 1; // inclusive
                daysInRange = diff > 0 ? diff : 1;
            } else {
                daysInRange = 1;
            }
        }

        summarySpans[1].innerText = formatNumber(Math.round(totalExpense / daysInRange));
    }
}

function renderTable(tableData) {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    tableData.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.innerHTML = `
            <div class="col-id">${index + 1}</div>
            <div class="col-cat">${item.category}</div>
            <div class="col-amt" style="color: ${item.color}">${formatNumber(item.amount)}</div>
            <div class="col-ratio" style="color: ${item.color}">${item.ratio > 0 ? item.ratio.toFixed(2) + '%' : '-'}</div>
            <div class="col-action"><i class="fa-solid fa-ellipsis-vertical action-dots" data-cat="${item.rawCategory}" data-type="${item.isIncome ? 'income' : 'expense'}" style="padding:4px;"></i></div>
        `;
        tbody.appendChild(row);
    });
}

function renderChart(chartData) {
    const ctx = document.getElementById('expenseChart').getContext('2d');

    if (typeof ChartDataLabels !== 'undefined') {
        Chart.register(ChartDataLabels);
    }

    if (expenseChart) {
        expenseChart.destroy();
    }

    if (chartData.length === 0) {
        expenseChart = new Chart(ctx, {
            type: 'pie',
            data: { labels: ['無資料'], datasets: [{ data: [1], backgroundColor: ['#eee'] }] },
            options: { plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } } }
        });
        return;
    }

    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartData.map(d => d.category),
            datasets: [{
                data: chartData.map(d => d.amount),
                backgroundColor: chartData.map(d => d.color),
                borderWidth: 1.5,
                borderColor: '#ffffff',
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    align: 'center',
                    labels: {
                        usePointStyle: true,
                        pointStyle: 'circle',
                        boxWidth: 8,
                        boxHeight: 8,
                        padding: 12,
                        color: '#111',
                        font: { size: 14, weight: 'bold' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return ` ${context.label}: ${formatNumber(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    color: '#000',
                    font: { weight: 'bold', size: 15, family: 'sans-serif' },
                    formatter: (value, ctx) => {
                        return ctx.chart.data.labels[ctx.dataIndex];
                    },
                    textStrokeColor: '#fff',
                    textStrokeWidth: 3,
                    align: 'center',
                    anchor: 'center',
                    display: function (context) {
                        const val = context.dataset.data[context.dataIndex];
                        // 依照總費用比例來隱藏太小的標籤
                        const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                        return (val / sum) > 0.05;
                    }
                }
            },
            layout: {
                padding: { top: 10, bottom: 10, left: 0, right: 0 }
            }
        }
    });
}

function openCatTxModal(catName, type) {
    const targetYear = state.viewDate.getFullYear();
    const targetMonth = state.viewDate.getMonth();
    const accTx = state.transactions.filter(t => {
        if (t.accountId !== state.currentAccountId) return false;
        if (!t.date) return false;
        const d = new Date(t.date);

        if (state.viewMode === 'month') {
            if (d.getFullYear() !== targetYear || d.getMonth() !== targetMonth) return false;
        } else if (state.viewMode === 'year') {
            if (d.getFullYear() !== targetYear) return false;
        } else if (state.viewMode === 'period') {
            const txDateStr = t.date.split('T')[0];
            if (state.periodStart && txDateStr < state.periodStart) return false;
            if (state.periodEnd && txDateStr > state.periodEnd) return false;
        }

        return t.type === type && (t.category || '其他') === catName;
    });

    const listContainer = document.getElementById('cat-tx-list');
    listContainer.dataset.currentCat = catName;
    listContainer.dataset.currentType = type;

    document.getElementById('cat-tx-title').innerText = `${catName} - 紀錄明細`;
    listContainer.innerHTML = '';

    if (accTx.length === 0) {
        listContainer.innerHTML = '<p style="text-align:center; color:#999; padding:20px;">無相關紀錄</p>';
    } else {
        // Sort by date (newest first)
        accTx.sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(t => {
            const div = document.createElement('div');
            div.style.cssText = "display: flex; justify-content: space-between; align-items: center; padding: 12px 0; border-bottom: 1px solid #eee;";

            const amtColor = type === 'expense' ? getColor(catName) : categoryColors['薪水'];

            div.innerHTML = `
                <div>
                    <div style="font-size: 16px; color: #333; font-weight: 500;">${t.desc || catName}</div>
                    <div style="font-size: 12px; color: #999; margin-top:4px;">${new Date(t.date).toLocaleString()}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <div style="font-weight: bold; font-size: 16px; color: ${amtColor}; margin-right: 8px;">${formatNumber(t.amount)}</div>
                    <button class="action-icon-btn edit-tx-btn" data-id="${t.id}" style="color: #3b82f6;"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-icon-btn del-tx-btn" data-id="${t.id}" style="color: #ef4444;"><i class="fa-solid fa-trash"></i></button>
                </div>
            `;
            listContainer.appendChild(div);
        });
    }

    document.getElementById('cat-tx-modal').classList.remove('hidden');
}
