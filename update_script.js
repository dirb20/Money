const fs = require('fs');
let text = fs.readFileSync('script.js', 'utf8');

text = text.replace(/< span style = "font-size:12px;color:#999;" > /g, '<span style="font-size:12px;color:#999;">');
text = text.replace(/ <\/span > /g, '</span>');
text = text.replace(/\$\{ t\.desc \}/g, '${t.desc}');
text = text.replace(/\$\{ dt\.getMonth\(\) \+ 1 \}/g, '${dt.getMonth() + 1}');
text = text.replace(/ \`分类明细：\$\{ catName \} \`/g, '`分類明細：${catName}`');

fs.writeFileSync('script.js', text, 'utf8');
