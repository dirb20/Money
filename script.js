/* Storage & State Manager */
let savedAccounts = null;
let savedTransactions = null;
let savedCustomAccTypes = null;
try {
    const rawAcc = localStorage.getItem('wavepay_accounts');
    const rawTx = localStorage.getItem('wavepay_transactions');
    const rawCustomType = localStorage.getItem('wavepay_custom_acc_types');
    if (rawAcc) savedAccounts = JSON.parse(rawAcc);
    if (rawTx) savedTransactions = JSON.parse(rawTx);
    if (rawCustomType) savedCustomAccTypes = JSON.parse(rawCustomType);
} catch (e) {
    console.warn('LocalStorage error:', e);
}

const defaultDate = new Date(2026, 2, 11); // Mock today to match screenshots: 2026-03-11

let state = {
    viewMode: 'month',
    viewDate: new Date(defaultDate),
    selectedDate: new Date(defaultDate), // For calendar daily selection
    periodStart: '2026-03-01',
    periodEnd: '2026-03-31',
    filter: { type: 'all', category: 'all' },
    accounts: (savedAccounts && savedAccounts.length > 0) ? savedAccounts : [
        { id: 'acc1', name: '現金', type: 'cash' },
        { id: 'acc2', name: '國泰世華', type: 'bank' }
    ],
    // 預設假資料
    transactions: savedTransactions || [
        { id: 't1', accountId: 'acc1', type: 'expense', category: '外食', amount: 85, date: '2026-03-11T12:00:00.000Z' },
        { id: 't2', accountId: 'acc2', type: 'expense', category: '外食', amount: 13, date: '2026-03-11T09:00:00.000Z' },
        { id: 't3', accountId: 'acc2', type: 'expense', category: '網路', desc: '小強|網路', amount: 689, date: '2026-03-11T08:00:00.000Z' },
        { id: 't4', accountId: 'acc1', type: 'expense', category: '食材', amount: 28, date: '2026-03-10T15:00:00.000Z' },
        { id: 't5', accountId: 'acc1', type: 'expense', category: '外食', amount: 270, date: '2026-03-10T12:30:00.000Z' },
        { id: 't6', accountId: 'acc2', type: 'expense', category: '加油', amount: 500, date: '2026-03-10T09:00:00.000Z' },
        { id: 't7', accountId: 'acc2', type: 'income', category: '薪水', amount: 54460, date: '2026-03-05T09:00:00.000Z' },
        { id: 't8', accountId: 'acc1', type: 'expense', category: '生活', amount: 17629, date: '2026-03-05T09:00:00.000Z' }
    ],
    customAccTypes: savedCustomAccTypes || [],
    currentAccountId: 'acc1' // For old chart view & adding
};
// Utils
function formatNumber(num) { return num.toLocaleString(); }
function getYYYYMMDD(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function isSameDay(d1, d2) { return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate(); }

const categoryColors = {
    '外食': '#ef4444', '交通': '#3b82f6', '生活': '#f59e0b', '食材': '#10b981',
    '水電': '#fde047', '網路': '#8b5cf6', '加油': '#ef4444', '薪水': '#10b981',
    '轉帳': '#6b7280', '其他': '#9ca3af'
};
const categoryIcons = {
    '外食': 'fa-utensils', '交通': 'fa-bus', '生活': 'fa-cart-shopping', '食材': 'fa-basket-shopping',
    '水電': 'fa-lightbulb', '網路': 'fa-wifi', '加油': 'fa-gas-pump', '薪水': 'fa-sack-dollar',
    '轉帳': 'fa-arrow-right-arrow-left', '其他': 'fa-tag'
};

function getColor(cat) { return categoryColors[cat] || categoryColors['其他']; }
function getIcon(cat) { return categoryIcons[cat] || 'fa-tag'; }

function getInitialBalances() {
    let mapping = {};
    state.accounts.forEach(a => mapping[a.id] = 0);
    state.transactions.forEach(t => {
        if (t.excludeType === 'exclude_acc') return;
        if (!mapping[t.accountId]) mapping[t.accountId] = 0;
        if (t.type === 'income') mapping[t.accountId] += t.amount;
        if (t.type === 'expense') mapping[t.accountId] -= t.amount;
        if (t.type === 'transfer') {
            mapping[t.accountId] -= t.amount;
            if (t.toAccountId) {
                if (mapping[t.toAccountId] === undefined) mapping[t.toAccountId] = 0;
                mapping[t.toAccountId] += t.amount;
            }
        }
    });
    return mapping;
}

function saveData() {
    try {
        localStorage.setItem('wavepay_accounts', JSON.stringify(state.accounts));
        localStorage.setItem('wavepay_transactions', JSON.stringify(state.transactions));
        localStorage.setItem('wavepay_custom_acc_types', JSON.stringify(state.customAccTypes));
    } catch (e) { console.warn(e); }
}

let editingTxId = null;
let expenseChart = null;

// --- DOM INIT ---
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    showView('ledger');
});

function showView(tabName) {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(nav => {
        nav.classList.remove('active');
        if (nav.dataset.tab === tabName) nav.classList.add('active');
    });
    document.querySelectorAll('.page-view').forEach(p => p.classList.add('hidden'));
    if (tabName === 'ledger') {
        document.getElementById('view-ledger').classList.remove('hidden');
        renderLedger();
    } else if (tabName === 'accounts') {
        document.getElementById('view-accounts').classList.remove('hidden');
        renderAccounts();
    } else if (tabName === 'chart') {
        document.getElementById('view-chart').classList.remove('hidden');
        renderChartAnalysis();
    } else if (tabName === 'settings') {
        document.getElementById('view-settings').classList.remove('hidden');
    }
}

// =================== 全域渲染與狀態管理 ===================
const renderAllViews = () => {
    const activeTab = document.querySelector('.bottom-nav .nav-item.active')?.dataset.tab;
    renderLedger();
    renderAccounts();
    renderChartAnalysis();
};

function updateDateDisplay(ids) {
    const y = state.viewDate.getFullYear();
    const m = state.viewDate.getMonth();

    ids.forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const span = el.querySelector('span');
        if (!span) return;

        let text = `${y}年${m + 1}月`;
        if (id === 'l-current-month-text' || id === 'c-current-month-text') {
            if (state.viewMode === 'year') {
                text = `${y}年`;
            } else if (state.viewMode === 'period') {
                const s = new Date(state.periodStart + 'T12:00:00');
                const e = new Date(state.periodEnd + 'T12:00:00');
                text = `${s.getMonth() + 1}/${s.getDate()} - ${e.getMonth() + 1}/${e.getDate()}`;
            }
        }
        span.innerText = text;
    });
}

// 月份切換 (主控邏輯)
const updateGlobalMonth = (offset) => {
    if (state.viewMode === 'year') {
        state.viewDate.setFullYear(state.viewDate.getFullYear() + offset);
    } else if (state.viewMode === 'period') {
        const start = new Date(state.periodStart + 'T12:00:00');
        const end = new Date(state.periodEnd + 'T12:00:00');
        start.setMonth(start.getMonth() + offset);
        end.setMonth(end.getMonth() + offset);
        state.periodStart = getYYYYMMDD(start);
        state.periodEnd = getYYYYMMDD(end);
    } else {
        state.viewDate.setMonth(state.viewDate.getMonth() + offset);
    }
    state.selectedDate = new Date(state.viewDate);
    state.selectedDate.setDate(1);
    renderAllViews();
};

// --- 事件綁定主進入點 ---
function setupEventListeners() {
    function populateAccTypeSelects() {
        const selects = [document.getElementById('new-acc-type'), document.getElementById('edit-acc-type')];
        selects.forEach(sel => {
            if (!sel) return;
            const currentVal = sel.value;
            sel.innerHTML = `<option value="cash">現金</option><option value="bank">銀行</option><option value="credit_card">信用卡</option><option value="other">其他</option>`;
            state.customAccTypes.forEach(t => {
                const opt = document.createElement('option');
                opt.value = t.key; opt.innerText = t.title; sel.appendChild(opt);
            });
            const addOpt = document.createElement('option');
            addOpt.value = '_add_new'; addOpt.innerText = '+ 新增類型...'; addOpt.style.color = '#3b82f6'; sel.appendChild(addOpt);
            if (sel.querySelector(`option[value="${currentVal}"]`)) sel.value = currentVal; else sel.value = 'cash';
        });
    }
    populateAccTypeSelects();

    const handleAccTypeChange = (e) => {
        if (e.target.value === '_add_new') {
            const newName = prompt('請輸入新帳戶類型的名稱:');
            if (newName && newName.trim()) {
                const newKey = 'custom_' + Date.now();
                state.customAccTypes.push({ key: newKey, title: newName.trim() });
                saveData();
                populateAccTypeSelects();
                e.target.value = newKey;
            } else e.target.value = 'cash';
        }
    };
    document.getElementById('new-acc-type')?.addEventListener('change', handleAccTypeChange);
    document.getElementById('edit-acc-type')?.addEventListener('change', handleAccTypeChange);

    // 底部導覽、帳本分頁
    document.querySelectorAll('.bottom-nav .nav-item[data-tab]').forEach(item => item.addEventListener('click', () => showView(item.dataset.tab)));
    document.getElementById('ledger-tab-calendar')?.addEventListener('click', (e) => {
        e.currentTarget.classList.add('active'); document.getElementById('ledger-tab-list')?.classList.remove('active');
        document.getElementById('ledger-calendar-view').classList.remove('hidden'); document.getElementById('ledger-list-view').classList.add('hidden');
    });
    document.getElementById('ledger-tab-list')?.addEventListener('click', (e) => {
        e.currentTarget.classList.add('active'); document.getElementById('ledger-tab-calendar')?.classList.remove('active');
        document.getElementById('ledger-list-view').classList.remove('hidden'); document.getElementById('ledger-calendar-view').classList.add('hidden');
    });

    // 左右切換按鈕
    const navBtnIds = ['l-prev-month-btn', 'l-next-month-btn', 'c-prev-month-btn', 'c-next-month-btn'];
    navBtnIds.forEach(id => {
        document.getElementById(id)?.addEventListener('click', () => updateGlobalMonth(id.includes('prev') ? -1 : 1));
    });

    document.getElementById('l-today-btn')?.addEventListener('click', () => {
        state.viewDate = new Date(defaultDate); state.selectedDate = new Date(defaultDate);
        renderAllViews();
    });

    // 模式切換 (月/年/期間)
    ['l-mode-tabs', 'c-mode-tabs'].forEach(id => {
        document.getElementById(id)?.addEventListener('click', (e) => {
            if (e.target.tagName === 'BUTTON') {
                const modeText = e.target.innerText;
                state.viewMode = modeText === '年' ? 'year' : (modeText === '期間' ? 'period' : 'month');
                ['l-mode-tabs', 'c-mode-tabs'].forEach(tid => {
                    document.getElementById(tid)?.querySelectorAll('button').forEach(b => {
                        b.classList.remove('active'); if (b.innerText === modeText) b.classList.add('active');
                    });
                });
                renderAllViews();
            }
        });
    });

    // 日期選擇器邏輯
    const dpModal = document.getElementById('date-picker-modal');
    const dpMonthInp = document.getElementById('dp-month-input'), dpYearInp = document.getElementById('dp-year-input');
    const dpStartInp = document.getElementById('dp-start-input'), dpEndInp = document.getElementById('dp-end-input');

    const clearOthers = (s) => {
        if (s === 'm') { dpYearInp.value = ''; dpStartInp.value = ''; dpEndInp.value = ''; }
        if (s === 'y') { dpMonthInp.value = ''; dpStartInp.value = ''; dpEndInp.value = ''; }
        if (s === 'p') { dpMonthInp.value = ''; dpYearInp.value = ''; }
    };
    dpMonthInp?.addEventListener('input', () => clearOthers('m'));
    dpYearInp?.addEventListener('input', () => clearOthers('y'));
    [dpStartInp, dpEndInp].forEach(i => i?.addEventListener('input', () => clearOthers('p')));

    const openDatePicker = (e) => {
        const isFromChart = e.currentTarget.id === 'c-current-month-text';
        const y = state.viewDate.getFullYear(), m = String(state.viewDate.getMonth() + 1).padStart(2, '0');
        if (isFromChart || state.viewMode === 'month') {
            document.getElementById('dp-month-view').classList.remove('hidden');
            document.getElementById('dp-year-view').classList.add('hidden');
            document.getElementById('dp-period-view').classList.add('hidden');
            dpMonthInp.value = `${y}-${m}`; clearOthers('m');
        } else if (state.viewMode === 'year') {
            document.getElementById('dp-year-view').classList.remove('hidden');
            document.getElementById('dp-month-view').classList.add('hidden');
            document.getElementById('dp-period-view').classList.add('hidden');
            dpYearInp.value = y; clearOthers('y');
        } else {
            document.getElementById('dp-period-view').classList.remove('hidden');
            document.getElementById('dp-month-view').classList.add('hidden');
            document.getElementById('dp-year-view').classList.add('hidden');
            dpStartInp.value = state.periodStart; dpEndInp.value = state.periodEnd; clearOthers('p');
        }
        dpModal.classList.remove('hidden');
    };
    ['l-current-month-text', 'c-current-month-text'].forEach(id => document.getElementById(id)?.addEventListener('click', openDatePicker));
    document.getElementById('close-dp-btn')?.addEventListener('click', () => dpModal.classList.add('hidden'));
    document.getElementById('apply-date-btn')?.addEventListener('click', () => {
        if (dpMonthInp.value) { state.viewMode = 'month'; const p = dpMonthInp.value.split('-'); state.viewDate = new Date(p[0], p[1] - 1, 1); }
        else if (dpYearInp.value) { state.viewMode = 'year'; state.viewDate = new Date(dpYearInp.value, 0, 1); }
        else if (dpStartInp.value) { state.viewMode = 'period'; state.periodStart = dpStartInp.value; state.periodEnd = dpEndInp.value; }
        dpModal.classList.add('hidden'); renderAllViews();
    });

    // 同步 Tabs UI
    const modeText = { 'month': '月', 'year': '年', 'period': '期間' }[state.viewMode];
    ['l-mode-tabs', 'c-mode-tabs'].forEach(tabId => {
        const tabs = document.getElementById(tabId)?.querySelectorAll('button');
        tabs?.forEach(b => {
            b.classList.remove('active');
            if (b.innerText === modeText) b.classList.add('active');
        });
    });

    renderAllViews();
    dpModal.classList.add('hidden');

    document.getElementById('cat-tx-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-tx-btn'); if (btn) openEditModal(btn.dataset.id);
    });
}

function formatFsDate(d) {
    const days = ['日', '一', '二', '三', '四', '五', '六'];
    return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 週${days[d.getDay()]}`;
}

const txModal = document.getElementById('transaction-modal');

function updateTxTypeUI(type) {
    document.querySelectorAll('.tx-tab').forEach(b => {
        b.classList.remove('active');
        if (b.dataset.type === type) b.classList.add('active');
    });

    const isTransfer = (type === 'transfer');
    document.getElementById('row-category').classList.toggle('hidden', isTransfer);
    document.getElementById('row-member').classList.toggle('hidden', isTransfer);
    document.getElementById('row-to-account').classList.toggle('hidden', !isTransfer);
    document.getElementById('lbl-account').innerText = isTransfer ? '轉出帳戶' : '帳戶';

    if (isTransfer) {
        const txToAcc = document.getElementById('tx-to-account');
        txToAcc.innerHTML = document.getElementById('tx-account').innerHTML;
    }
}

// 新增紀錄 Modal 顯示
// 帳戶管理與排序列表
let accSortableInst = null;
const renderAccManageList = () => {
    const listEl = document.getElementById('acc-select-list');
    if (!listEl) return;
    listEl.innerHTML = '';
    state.accounts.forEach(a => {
        const item = document.createElement('div');
        item.className = 'acc-manage-item';
        item.style.cssText = 'padding: 12px; background: white; border-bottom: 1px solid #eee; display: flex; align-items: center; justify-content: space-between; cursor: grab;';
        item.dataset.id = a.id;
        const typeText = {
            'cash': '現金', 'bank': '銀行', 'credit_card': '信用卡', 'other': '其他'
        }[a.type] || state.customAccTypes.find(t => t.key === a.type)?.title || '未知';

        item.innerHTML = `
                <div><i class="fa-solid fa-grip-lines" style="color:#ccc; margin-right: 12px; cursor: grab;"></i> ${a.name}</div>
                <div style="color: #999; font-size: 14px;">${typeText}</div>
            `;
        listEl.appendChild(item);
    });

    if (window.Sortable && !accSortableInst) {
        accSortableInst = new Sortable(listEl, {
            animation: 150,
            ghostClass: 'sortable-ghost',
            handle: '.fa-grip-lines',
            onEnd: function (evt) {
                const itemEl = evt.item;  // dragged HTMLElement
                const accId = itemEl.dataset.id;
                const oldIndex = evt.oldIndex;
                const newIndex = evt.newIndex;

                if (oldIndex !== newIndex) {
                    const movedItem = state.accounts.splice(oldIndex, 1)[0];
                    state.accounts.splice(newIndex, 0, movedItem);
                    saveData();
                    renderAccounts();
                }
            }
        });
    }
};

// 首頁右上角點擊打開帳戶管理 (目前可能沒實作按鈕或是在其他地方綁定？)
// 尋找綁定 account-modal 的地方
const pageAddAccBtn = document.getElementById('page-add-acc-btn');
if (pageAddAccBtn) {
    pageAddAccBtn.addEventListener('click', () => {
        renderAccManageList();
        document.getElementById('new-acc-name').value = '';
        document.getElementById('new-acc-type').value = 'cash';
        document.getElementById('account-modal').classList.remove('hidden');
    });
}

const addBtns = [document.getElementById('nav-add-btn'), document.getElementById('fab-add')];
addBtns.forEach(btn => {
    if (btn) btn.addEventListener('click', () => {
        editingTxId = null;
        document.getElementById('tx-amount').value = '';
        document.getElementById('tx-desc').value = '';
        document.getElementById('tx-exclude').value = 'none';

        // Populate account select
        const accSel = document.getElementById('tx-account');
        accSel.innerHTML = '';
        state.accounts.forEach(a => {
            const opt = document.createElement('option');
            opt.value = a.id; opt.innerText = a.name;
            if (a.id === state.currentAccountId) opt.selected = true;
            accSel.appendChild(opt);
        });

        const curDate = state.selectedDate || new Date();
        document.getElementById('tx-date').value = getYYYYMMDD(curDate);
        document.getElementById('fs-tx-date-display').innerText = formatFsDate(curDate);

        updateTxTypeUI('expense');

        document.getElementById('delete-btn-container').innerHTML = ''; // 清除刪除按鈕

        txModal.classList.remove('hidden');
    });
});
document.getElementById('close-tx-modal').addEventListener('click', () => txModal.classList.add('hidden'));

// 委派點擊編輯按鈕 (三個點點)
const openEditModal = (txId) => {
    const tx = state.transactions.find(t => t.id === txId);
    if (!tx) return;
    editingTxId = txId;

    // 賦填資料
    const accSel = document.getElementById('tx-account');
    accSel.innerHTML = '';
    state.accounts.forEach(a => {
        const opt = document.createElement('option');
        opt.value = a.id; opt.innerText = a.name;
        if (a.id === tx.accountId) opt.selected = true;
        accSel.appendChild(opt);
    });

    updateTxTypeUI(tx.type);

    if (tx.type === 'transfer' && tx.toAccountId) {
        document.getElementById('tx-to-account').value = tx.toAccountId;
    }

    document.getElementById('tx-amount').value = tx.amount;
    document.getElementById('tx-category').value = tx.category || '其他';
    document.getElementById('tx-desc').value = tx.desc || '';
    document.getElementById('tx-date').value = tx.date.split('T')[0];
    document.getElementById('fs-tx-date-display').innerText = formatFsDate(new Date(tx.date));
    document.getElementById('tx-exclude').value = tx.excludeType || 'none';

    // 刪除按鈕
    const delContainer = document.getElementById('delete-btn-container');
    delContainer.innerHTML = '';
    const delBtn = document.createElement('button');
    delBtn.className = 'btn';
    delBtn.style.cssText = 'width: 100%; font-size: 16px; padding: 12px; background: white; color: #ef4444; border: 1px solid #ef4444; border-radius: 6px;';
    delBtn.innerText = '刪除此紀錄';
    delBtn.addEventListener('click', () => {
        if (confirm('確定要刪除這筆紀錄嗎？')) {
            state.transactions = state.transactions.filter(t => t.id !== editingTxId);
            saveData();
            txModal.classList.add('hidden');
            const activeTabs = document.querySelectorAll('.bottom-nav .nav-item.active');
            if (activeTabs.length > 0) showView(activeTabs[0].dataset.tab);
        }
    });
    delContainer.appendChild(delBtn);

    txModal.classList.remove('hidden');
};

document.getElementById('daily-transactions').addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-tx-btn');
    if (btn) openEditModal(btn.dataset.id);
});

document.getElementById('list-transactions').addEventListener('click', (e) => {
    const btn = e.target.closest('.edit-tx-btn');
    if (btn) openEditModal(btn.dataset.id);
});

// 切換收入/支出/轉帳
document.querySelectorAll('.tx-tab').forEach(b => {
    b.addEventListener('click', () => {
        updateTxTypeUI(b.dataset.type);
    });
});

// 因為點擊頂部日期而想要變更日期的 dummy 功能 (若要實際做可以跳出 date picker)
document.getElementById('fs-tx-date-display').addEventListener('click', () => {
    document.getElementById('tx-date').showPicker && document.getElementById('tx-date').showPicker();
});
document.getElementById('tx-date').addEventListener('change', (e) => {
    if (e.target.value) {
        document.getElementById('fs-tx-date-display').innerText = formatFsDate(new Date(`${e.target.value}T12:00:00`));
    }
});

// 儲存紀錄
document.getElementById('save-tx-btn').addEventListener('click', () => {
    const amt = parseFloat(document.getElementById('tx-amount').value);
    if (!amt || amt <= 0) { alert('請輸入有效金額'); return; }

    let txType = 'expense';
    document.querySelectorAll('.tx-tab').forEach(b => { if (b.classList.contains('active')) txType = b.dataset.type; });

    const dStr = document.getElementById('tx-date').value;
    const d = dStr ? new Date(`${dStr}T12:00:00`) : new Date();

    if (editingTxId) {
        const tx = state.transactions.find(t => t.id === editingTxId);
        if (tx) {
            tx.accountId = document.getElementById('tx-account').value;
            tx.type = txType;
            tx.desc = document.getElementById('tx-desc').value.trim();
            tx.amount = amt;
            tx.date = d.toISOString();
            tx.excludeType = document.getElementById('tx-exclude').value;

            if (txType === 'transfer') {
                tx.toAccountId = document.getElementById('tx-to-account').value;
                tx.category = '轉帳';
            } else {
                tx.category = document.getElementById('tx-category').value;
                tx.toAccountId = null;
            }
        }
        editingTxId = null;
    } else {
        const tx = {
            id: Date.now().toString(),
            accountId: document.getElementById('tx-account').value,
            type: txType,
            desc: document.getElementById('tx-desc').value.trim(),
            amount: amt,
            date: d.toISOString(),
            excludeType: document.getElementById('tx-exclude').value
        };
        if (txType === 'transfer') {
            tx.toAccountId = document.getElementById('tx-to-account').value;
            tx.category = '轉帳';
        } else {
            tx.category = document.getElementById('tx-category').value;
        }
        state.transactions.push(tx);
    }

    saveData();
    txModal.classList.add('hidden');
    document.getElementById('tx-amount').value = '';
    document.getElementById('tx-desc').value = '';

    // Refresh Current View
    const activeTabs = document.querySelectorAll('.bottom-nav .nav-item.active');
    if (activeTabs.length > 0) showView(activeTabs[0].dataset.tab);
});

// 帳戶管理
const addAccBtn = document.getElementById('page-add-acc-btn');
const accModal = document.getElementById('account-modal');
if (addAccBtn) addAccBtn.addEventListener('click', () => { accModal.classList.remove('hidden'); });
document.getElementById('close-acc-modal').addEventListener('click', () => accModal.classList.add('hidden'));

document.getElementById('add-acc-btn').addEventListener('click', () => {
    const nam = document.getElementById('new-acc-name').value.trim();
    const typ = document.getElementById('new-acc-type').value;
    if (nam) {
        state.accounts.push({ id: Date.now().toString(), name: nam, type: typ });
        saveData();
        accModal.classList.add('hidden');
        document.getElementById('new-acc-name').value = '';
        renderAccounts();
    }
});

// 清單日期區間 Header (快速切換)
const listTabs = document.querySelectorAll('.list-tabs button');
listTabs.forEach(b => {
    b.addEventListener('click', () => {
        listTabs.forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        renderLedgerList();
    });
});

// 帳戶編輯
let editingAccountId = null;
const editAccModal = document.getElementById('edit-acc-modal');
if (editAccModal) {
    document.getElementById('close-edit-acc-modal').addEventListener('click', () => editAccModal.classList.add('hidden'));

    document.getElementById('account-lists')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-acc-btn');
        if (btn) {
            const aId = btn.dataset.id;
            const acc = state.accounts.find(a => a.id === aId);
            if (!acc) return;
            editingAccountId = aId;
            document.getElementById('edit-acc-name').value = acc.name;
            document.getElementById('edit-acc-type').value = acc.type || 'other';
            editAccModal.classList.remove('hidden');
        }
    });

    document.getElementById('save-acc-btn').addEventListener('click', () => {
        const acc = state.accounts.find(a => a.id === editingAccountId);
        if (acc) {
            acc.name = document.getElementById('edit-acc-name').value.trim() || acc.name;
            acc.type = document.getElementById('edit-acc-type').value;
            saveData();
            renderAccounts();
            editAccModal.classList.add('hidden');
        }
    });

    document.getElementById('delete-acc-btn').addEventListener('click', () => {
        if (confirm('確定要刪除這個帳戶嗎？（注意：若帳戶內仍有紀錄可能會出錯）')) {
            state.accounts = state.accounts.filter(a => a.id !== editingAccountId);
            saveData();
            renderAccounts();
            editAccModal.classList.add('hidden');
        }
    });
}

// 圖表圓表分析: 點擊三點查看詳細
const catModal = document.getElementById('cat-tx-modal');
if (catModal) {
    document.getElementById('close-cat-tx-modal').addEventListener('click', () => catModal.classList.add('hidden'));

    document.getElementById('table-body')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.view-cat-btn');
        if (btn) {
            const catName = btn.dataset.category;
            const dList = document.getElementById('cat-tx-list');
            const title = document.getElementById('cat-tx-title');

            title.innerText = `分類明細：${catName} `;
            dList.innerHTML = '';

            const y = state.viewDate.getFullYear();
            const m = state.viewDate.getMonth();

            const filtered = state.transactions.filter(t => {
                const d = new Date(t.date);
                return d.getFullYear() === y && d.getMonth() === m && t.type === 'expense' && t.excludeType !== 'exclude_io' && (t.category || '其他') === catName;
            });

            if (filtered.length === 0) {
                dList.innerHTML = '<div style="padding: 20px; text-align: center; color: #999;">沒有紀錄</div>';
            } else {
                filtered.forEach(t => {
                    let accName = state.accounts.find(a => a.id === t.accountId)?.name || '未知';
                    const descStr = t.desc ? `< span style = "font-size:12px;color:#999;" > ${t.desc}</span > ` : '';

                    const item = document.createElement('div');
                    item.className = 'tx-item';

                    // add specific date overlay
                    const dt = new Date(t.date);
                    const dayStr = `${dt.getMonth() + 1}/${dt.getDate()}`;

                    item.innerHTML = `
                            <div class="tx-item-left">
                                <div class="tx-icon" style="color: ${getColor(catName)}"><i class="fa-solid ${getIcon(catName)}"></i></div>
                                <div class="tx-details">
                                    <div class="tx-cat">${catName}${descStr}</div>
                                    <div style="font-size:12px; color:#999; margin-top:2px;">${dayStr}</div>
                                </div>
                            </div>
                            <div class="tx-item-right" style="display: flex; align-items: center; gap: 8px;">
                                <div style="text-align: right;">
                                    <div class="tx-amt exp">${formatNumber(t.amount)}</div>
                                    <div class="tx-acc" style="text-align: right; color: #999; font-size: 12px; margin-top: 2px;">${accName}</div>
                                </div>
                                <i class="fa-solid fa-ellipsis-vertical action-dots edit-tx-btn" data-id="${t.id}" style="color: #ccc; padding: 4px; cursor: pointer; font-size: 16px;"></i>
                            </div>
                        `;
                    dList.appendChild(item);
                });
                if (window.Sortable) {
                    new Sortable(dList, { animation: 150, ghostClass: 'sortable-ghost' });
                }
            }

            catModal.classList.remove('hidden');
        }
    });

    document.getElementById('cat-tx-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.edit-tx-btn');
        if (btn) openEditModal(btn.dataset.id);
    });
}


// --- 帳本渲染入口 ---
function renderLedger() {
    updateDateDisplay(['l-current-month-text', 'c-current-month-text']);

    // 確認當前顯示的是日曆還是列表
    if (!document.getElementById('ledger-calendar-view').classList.contains('hidden')) {
        renderLedgerCalendar();
    }
    if (!document.getElementById('ledger-list-view').classList.contains('hidden')) {
        renderLedgerList();
    }
}


function renderLedgerCalendar() {
    const calBody = document.getElementById('cal-body');
    calBody.innerHTML = '';

    const y = state.viewDate.getFullYear();
    const m = state.viewDate.getMonth();

    const firstDay = new Date(y, m, 1);
    const lastDay = new Date(y, m + 1, 0);

    let startDayIdx = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1; // Mon = 0
    let totalCells = Math.ceil((startDayIdx + lastDay.getDate()) / 7) * 7;
    if (totalCells < 42) totalCells = 42;

    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - startDayIdx);

    const txGrouped = {};
    state.transactions.forEach(t => {
        const d = new Date(t.date);
        const k = getYYYYMMDD(d);
        if (!txGrouped[k]) txGrouped[k] = { exp: 0, inc: 0 };

        // 如果設定為不計入收支，則不累加到月曆上
        if (t.excludeType === 'exclude_io') return;

        if (t.type === 'expense') txGrouped[k].exp += t.amount;
        if (t.type === 'income') txGrouped[k].inc += t.amount;
    });

    // Generate Grid
    for (let i = 0; i < totalCells; i++) {
        const curDate = new Date(startDate);
        curDate.setDate(startDate.getDate() + i);

        const cell = document.createElement('div');
        cell.className = 'cal-cell';
        if (curDate.getMonth() !== m) cell.classList.add('other-month');
        if (isSameDay(curDate, defaultDate)) cell.classList.add('today'); // highlight exact default date
        if (isSameDay(curDate, state.selectedDate)) cell.classList.add('selected');

        const dateEl = document.createElement('div');
        dateEl.className = 'cal-date';
        dateEl.innerText = curDate.getDate();
        cell.appendChild(dateEl);

        const dateStr = getYYYYMMDD(curDate);
        if (txGrouped[dateStr]) {
            if (txGrouped[dateStr].inc > 0) {
                const v = document.createElement('div'); v.className = 'cal-val inc'; v.innerText = formatNumber(txGrouped[dateStr].inc); cell.appendChild(v);
            }
            if (txGrouped[dateStr].exp > 0) {
                const v = document.createElement('div'); v.className = 'cal-val exp'; v.innerText = formatNumber(txGrouped[dateStr].exp); cell.appendChild(v);
            }
        }

        cell.addEventListener('click', () => {
            state.selectedDate = new Date(curDate);
            renderLedgerCalendar(); // Re-render to update selected state and list
        });

        calBody.appendChild(cell);
    }

    // Render Daily Summary Below Calendar
    const selDateStr = getYYYYMMDD(state.selectedDate);
    const dailyTx = state.transactions.filter(t => getYYYYMMDD(new Date(t.date)) === selDateStr);

    let dailyExp = 0, dailyInc = 0;
    const txListEl = document.getElementById('daily-transactions');
    txListEl.innerHTML = '';

    if (dailyTx.length === 0) {
        txListEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">沒有紀錄</div>`;
    } else {
        dailyTx.forEach(t => {
            if (t.excludeType !== 'exclude_io') {
                if (t.type === 'expense') dailyExp += t.amount;
                if (t.type === 'income') dailyInc += t.amount;
            }

            let accName = state.accounts.find(a => a.id === t.accountId)?.name || '未知帳戶';
            let catName = t.category || '其他';
            const descStr = t.desc ? ` | ${t.desc}` : '';

            if (t.type === 'transfer') {
                const toAccName = state.accounts.find(a => a.id === t.toAccountId)?.name || '未知帳戶';
                catName = '轉帳';
                accName = `${accName} ➔ ${toAccName}`;
            }

            const item = document.createElement('div');
            item.className = 'tx-item';
            item.dataset.id = t.id;

            const amtClass = t.type === 'expense' ? 'exp' : (t.type === 'income' ? 'inc' : '');

            item.innerHTML = `
                <div class="tx-item-left">
                    <div class="tx-icon" style="color: ${getColor(catName)}"><i class="fa-solid ${getIcon(catName)}"></i></div>
                    <div class="tx-details">
                        <div class="tx-cat">${catName} <span style="font-size:12px;color:#999;">${descStr}</span></div>
                    </div>
                </div>
                <div class="tx-item-right" style="display: flex; align-items: center; gap: 8px;">
                    <div style="text-align: right;">
                        <div class="tx-amt ${amtClass}" ${t.type === 'transfer' ? 'style="color:#6b7280;"' : ''}>${formatNumber(t.amount)}</div>
                        <div class="tx-acc" style="text-align: right; color: #999; font-size: 12px; margin-top: 2px;">${accName}</div>
                    </div>
                    <i class="fa-solid fa-ellipsis-vertical action-dots edit-tx-btn" data-id="${t.id}" style="color: #ccc; padding: 4px; cursor: pointer; font-size: 16px;"></i>
                </div>
            `;
            txListEl.appendChild(item);
        });
    }

    let summaryStr = [];
    if (dailyExp > 0) summaryStr.push(`支出:${formatNumber(dailyExp)}`);
    if (dailyInc > 0) summaryStr.push(`收入:${formatNumber(dailyInc)}`);
    if (summaryStr.length === 0) summaryStr = ['無收支'];

    document.getElementById('daily-total-exp').innerText = formatNumber(dailyExp);
    document.querySelector('.daily-summary').innerText = summaryStr.join('  ');

    // Add Sortable to daily tx list
    if (window.Sortable) {
        new Sortable(txListEl, {
            animation: 150,
            ghostClass: 'sortable-ghost'
            // We can add onEnd here to update a sortOrder in state if actual db persistence is needed
        });
    }
}

function renderLedgerList() {
    const y = state.viewDate.getFullYear();
    const m = state.viewDate.getMonth();

    // Filter by mode
    let monthTx = state.transactions.filter(t => {
        const d = new Date(t.date);
        if (state.viewMode === 'year') {
            return d.getFullYear() === y;
        } else if (state.viewMode === 'period') {
            const start = new Date(state.periodStart + 'T00:00:00');
            const end = new Date(state.periodEnd + 'T23:59:59');
            return d >= start && d <= end;
        }
        return d.getFullYear() === y && d.getMonth() === m;
    });

    monthTx.sort((a, b) => new Date(b.date) - new Date(a.date));

    let totalInc = 0;
    let totalExp = 0;
    monthTx.forEach(t => {
        if (t.excludeType !== 'exclude_io') {
            if (t.type === 'income') totalInc += t.amount;
            if (t.type === 'expense') totalExp += t.amount;
        }
    });

    document.getElementById('list-total-inc').innerText = formatNumber(totalInc);
    document.getElementById('list-total-exp').innerText = formatNumber(totalExp);
    document.getElementById('list-total-net').innerText = formatNumber(totalInc - totalExp);

    // Group by Date
    const grouped = {};
    monthTx.forEach(t => {
        const dStr = getYYYYMMDD(new Date(t.date));
        if (!grouped[dStr]) grouped[dStr] = [];
        grouped[dStr].push(t);
    });

    const listEl = document.getElementById('list-transactions');
    listEl.innerHTML = '';

    const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

    if (sortedDates.length === 0) listEl.innerHTML = `<div style="padding: 20px; text-align: center; color: #999;">沒有紀錄</div>`;

    const dayNames = ['日', '一', '二', '三', '四', '五', '六'];

    sortedDates.forEach(dateStr => {
        const d = new Date(dateStr);
        const dateObjText = `${d.getMonth() + 1}月${d.getDate()}日 週${dayNames[d.getDay()]}`;

        let dayExp = 0;
        grouped[dateStr].forEach(t => { if (t.type === 'expense' && t.excludeType !== 'exclude_io') dayExp += t.amount; });

        const header = document.createElement('div');
        header.className = 'list-group-header';
        header.innerHTML = `<span>${dateObjText}</span><span>支出:${formatNumber(dayExp)}</span>`;
        listEl.appendChild(header);

        const groupContainer = document.createElement('div');
        groupContainer.className = 'tx-group-container';
        listEl.appendChild(groupContainer);

        grouped[dateStr].forEach(t => {
            let accName = state.accounts.find(a => a.id === t.accountId)?.name || '未知';
            let catName = t.category || '其他';
            const descStr = t.desc ? ` <span style="font-size:12px;color:#999;">${t.desc}</span>` : '';

            if (t.type === 'transfer') {
                const toAccName = state.accounts.find(a => a.id === t.toAccountId)?.name || '未知帳戶';
                catName = '轉帳';
                accName = `${accName} ➔ ${toAccName}`;
            }

            const item = document.createElement('div');
            item.className = 'tx-item';

            const amtClass = t.type === 'expense' ? 'exp' : (t.type === 'income' ? 'inc' : '');

            item.innerHTML = `
                <div class="tx-item-left">
                    <div class="tx-icon" style="color: ${getColor(catName)}"><i class="fa-solid ${getIcon(catName)}"></i></div>
                    <div class="tx-details">
                        <div class="tx-cat">${catName}${descStr}</div>
                    </div>
                </div>
                <div class="tx-item-right" style="display: flex; align-items: center; gap: 8px;">
                    <div style="text-align: right;">
                        <div class="tx-amt ${amtClass}" ${t.type === 'transfer' ? 'style="color:#6b7280;"' : ''}>${formatNumber(t.amount)}</div>
                        <div class="tx-acc" style="text-align: right; color: #999; font-size: 12px; margin-top: 2px;">${accName}</div>
                    </div>
                    <i class="fa-solid fa-ellipsis-vertical action-dots edit-tx-btn" data-id="${t.id}" style="color: #ccc; padding: 4px; cursor: pointer; font-size: 16px;"></i>
                </div>
            `;
            groupContainer.appendChild(item);
        });

        if (window.Sortable) {
            new Sortable(groupContainer, { animation: 150, ghostClass: 'sortable-ghost' });
        }
    });
}

// =================== Accounts 畫面 ===================
function renderAccounts() {
    const balances = getInitialBalances();
    let totAssets = 0;
    let totLiabs = 0;

    const accGroups = { cash: [], bank: [], credit_card: [], other: [] };
    state.customAccTypes.forEach(t => {
        if (!accGroups[t.key]) accGroups[t.key] = [];
    });

    state.accounts.forEach(a => {
        const bal = balances[a.id] || 0;
        if (bal >= 0) totAssets += bal; else totLiabs += Math.abs(bal);

        let targetGroup = accGroups[a.type] || accGroups.other;
        targetGroup.push({ ...a, balance: bal });
    });

    const netWorth = totAssets - totLiabs;
    document.getElementById('acc-net-worth').innerText = `$${formatNumber(netWorth)}`;
    document.getElementById('acc-total-assets').innerText = formatNumber(totAssets);
    document.getElementById('acc-total-liab').innerText = formatNumber(totLiabs);

    const listEl = document.getElementById('account-lists');
    listEl.innerHTML = '';


    const groupDefs = [
        { key: 'cash', title: '現金', iconClass: 'cash-icon', defaultIcon: '<i class="fa-solid fa-money-bill-wave"></i>' },
        { key: 'bank', title: '銀行', iconClass: 'bank-icon', defaultIcon: '<i class="fa-solid fa-building-columns"></i>' },
        { key: 'credit_card', title: '信用卡', iconClass: 'bank-icon', defaultIcon: '<i class="fa-solid fa-credit-card"></i>' },
        { key: 'other', title: '其他', iconClass: 'cash-icon', defaultIcon: '<i class="fa-solid fa-piggy-bank"></i>' }
    ];

    state.customAccTypes.forEach(t => {
        groupDefs.push({
            key: t.key,
            title: t.title,
            iconClass: 'cash-icon',
            defaultIcon: '<i class="fa-solid fa-folder-open"></i>'
        });
    });

    groupDefs.forEach(def => {
        const arr = accGroups[def.key];
        if (!arr || arr.length === 0) return;

        let tot = arr.reduce((sum, a) => sum + a.balance, 0);
        const head = document.createElement('div');
        head.className = 'acc-category-header';
        head.innerHTML = `<span>${def.title}:${formatNumber(tot)}</span>`;
        listEl.appendChild(head);

        const groupContainer = document.createElement('div');
        groupContainer.className = 'acc-group-container';
        listEl.appendChild(groupContainer);

        arr.forEach(a => {
            const item = document.createElement('div');
            item.className = 'acc-item';

            let iconHtml = def.defaultIcon;
            if (def.key === 'bank') {
                if (a.name.includes('國泰')) iconHtml = '<i class="fa-solid fa-tree"></i>';
                if (a.name.includes('中信') || a.name.includes('中國信託')) iconHtml = '<i class="fa-solid fa-c"></i>';
            }

            item.innerHTML = `
                <div class="acc-icon ${def.iconClass}">${iconHtml}</div>
                <div class="acc-item-details">
                    <div class="acc-item-title">${a.name}</div>
                    <div class="acc-item-cur">TWD</div>
                </div>
                <div class="acc-item-bal" style="color: ${a.balance >= 0 ? '#10b981' : '#ef4444'}">${formatNumber(Math.abs(a.balance))}</div>
                <div style="display:flex; align-items:center;">
                    <i class="fa-solid fa-chevron-right" style="color:#ccc; margin-left:8px; font-size:14px;"></i>
                    <i class="fa-solid fa-ellipsis-vertical action-dots edit-acc-btn" data-id="${a.id}" style="color: #ccc; padding: 4px; cursor: pointer; font-size: 16px; margin-left: 12px;"></i>
                </div>
            `;
            groupContainer.appendChild(item);
        });

        if (window.Sortable) {
            new Sortable(groupContainer, { animation: 150, ghostClass: 'sortable-ghost' });
        }
    });
}

// =================== 圖表分析 (舊版保留) ===================
function renderChartAnalysis() {
    const y = state.viewDate.getFullYear();
    const m = state.viewDate.getMonth();

    const accTx = state.transactions.filter(t => {
        const d = new Date(t.date);
        let match = false;
        if (state.viewMode === 'year') {
            match = (d.getFullYear() === y);
        } else if (state.viewMode === 'period') {
            const start = new Date(state.periodStart + 'T00:00:00');
            const end = new Date(state.periodEnd + 'T23:59:59');
            match = (d >= start && d <= end);
        } else {
            match = (d.getFullYear() === y && d.getMonth() === m);
        }
        return match && t.type === 'expense' && t.excludeType !== 'exclude_io';
    });

    let totalExpense = 0;
    let expenseGroup = {};

    accTx.forEach(t => {
        let cat = t.category || '其他';
        totalExpense += t.amount;
        if (!expenseGroup[cat]) expenseGroup[cat] = 0;
        expenseGroup[cat] += t.amount;
    });

    let chartData = Object.keys(expenseGroup).map(cat => ({
        category: cat,
        amount: expenseGroup[cat],
        ratio: totalExpense > 0 ? (expenseGroup[cat] / totalExpense) * 100 : 0,
        color: getColor(cat)
    })).sort((a, b) => b.amount - a.amount);

    document.getElementById('chart-total-exp').innerText = formatNumber(totalExpense);

    // 計算平均每日支出
    let daysInRange = 30;
    if (state.viewMode === 'year') {
        daysInRange = 365;
    } else if (state.viewMode === 'period') {
        const start = new Date(state.periodStart + 'T00:00:00');
        const end = new Date(state.periodEnd + 'T23:59:59');
        daysInRange = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));
    }
    document.getElementById('chart-avg-exp').innerText = formatNumber(Math.round(totalExpense / daysInRange));


    // Render Table
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';
    chartData.forEach((item, index) => {
        const row = document.createElement('div');
        row.className = 'table-row';
        row.innerHTML = `
            <div class="col-id">${index + 1}</div>
            <div class="col-cat">${item.category}</div>
            <div class="col-amt" style="color: ${item.color}">${formatNumber(item.amount)}</div>
            <div class="col-ratio" style="color: ${item.color}">${item.ratio > 0 ? item.ratio.toFixed(2) + '%' : '-'}</div>
            <div class="col-action"><i class="fa-solid fa-ellipsis-vertical action-dots view-cat-btn" data-category="${item.category}" style="cursor: pointer; padding: 4px;"></i></div>
        `;
        tbody.appendChild(row);
    });

    if (window.Sortable) {
        new window.Sortable(tbody, { animation: 150, ghostClass: 'sortable-ghost' });
    }

    // Render Chart
    const ctx = document.getElementById('expenseChart').getContext('2d');
    if (typeof ChartDataLabels !== 'undefined') Chart.register(ChartDataLabels);
    if (expenseChart) expenseChart.destroy();
    if (chartData.length === 0) {
        expenseChart = new Chart(ctx, { type: 'pie', data: { labels: ['無資料'], datasets: [{ data: [1], backgroundColor: ['#eee'] }] }, options: { plugins: { legend: { display: false }, tooltip: { enabled: false }, datalabels: { display: false } } } });
        return;
    }
    expenseChart = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: chartData.map(d => d.category),
            datasets: [{ data: chartData.map(d => d.amount), backgroundColor: chartData.map(d => d.color), borderWidth: 1.5, borderColor: '#ffffff' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right', labels: { usePointStyle: true, font: { size: 14, weight: 'bold' } } },
                datalabels: {
                    color: '#000', font: { weight: 'bold', size: 15 },
                    formatter: (value, ctx) => ctx.chart.data.labels[ctx.dataIndex],
                    textStrokeColor: '#fff', textStrokeWidth: 3,
                    display: function (context) {
                        const sum = context.dataset.data.reduce((a, b) => a + b, 0);
                        return (context.dataset.data[context.dataIndex] / sum) > 0.05;
                    }
                }
            }
        }
    });
}
