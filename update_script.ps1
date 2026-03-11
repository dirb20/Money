
$content = Get-Content -Path "script.js" -Raw -Encoding UTF8

# Function: formatFsDate
$content = $content -replace "(?sm)function isSameDay\(d1, d2\).*?return.*?$", "$&`nfunction formatFsDate(d) { const days = ['日','一','二','三','四','五','六']; return d.getFullYear() + '年' + (d.getMonth() + 1) + '月' + d.getDate() + '日 週' + days[d.getDay()]; }"

# getInitialBalances
$replacement1 = @"
function getInitialBalances() {
    let mapping = {};
    state.accounts.forEach(a => mapping[a.id] = 0);
    state.transactions.forEach(t => {
        if (!mapping[t.accountId]) mapping[t.accountId] = 0;
        if (t.type === 'income') mapping[t.accountId] += t.amount;
        if (t.type === 'expense') mapping[t.accountId] -= t.amount;
        if (t.type === 'transfer') {
            mapping[t.accountId] -= t.amount;
            if (t.toAccountId && mapping[t.toAccountId] !== undefined) mapping[t.toAccountId] += t.amount;
        }
    });
    return mapping;
}
"@
$content = $content -replace "(?sm)function getInitialBalances\(\) \{.*?return mapping;`n\}", $replacement1

Set-Content -Path "script.js" -Value $content -Encoding UTF8

