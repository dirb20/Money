import codecs
with codecs.open('script.js','r', 'utf-8') as f:
    text = f.read()

text = text.replace('< span style = "font-size:12px;color:#999;" > ', '<span style="font-size:12px;color:#999;">')
text = text.replace(' </span > ', '</span>')
text = text.replace('${ t.desc }', '${t.desc}')
text = text.replace('${ dt.getMonth() + 1 }', '${dt.getMonth() + 1}')

with codecs.open('script.js','w', 'utf-8') as f:
    f.write(text)
