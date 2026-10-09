"""Read-only extraction; page/paragraph and file provenance retained."""
import json, re, hashlib, zipfile, struct, io
from pathlib import Path
from xml.etree import ElementTree as ET
from pypdf import PdfReader
import olefile

def read_doc(p):
    with olefile.OleFileIO(str(p)) as ole:
        word = ole.openstream('WordDocument').read()
        table = ole.openstream('1Table' if struct.unpack_from('<H', word, 10)[0] & 512 else '0Table').read()
    fc, length = struct.unpack_from('<II', word, 418)
    clx = table[fc:fc+length]
    i = 0
    while i < len(clx) and clx[i] == 1:
        i += 3 + struct.unpack_from('<H', clx, i+1)[0]
    if i >= len(clx) or clx[i] != 2:
        raise ValueError('Piece table DOC não encontrada; não usar extração parcial.')
    size = struct.unpack_from('<I',clx,i+1)[0]
    plc = clx[i+5:i+5+size]
    count = (size-4)//12
    cps = struct.unpack_from('<'+'I'*(count+1),plc,0)
    parts = []
    for j in range(count):
        rawfc = struct.unpack_from('<I',plc,4*(count+1)+j*8+2)[0]
        compressed = bool(rawfc & 0x40000000)
        offset = rawfc & 0x3fffffff
        if compressed: offset //= 2
        length = cps[j+1]-cps[j]
        parts.append(word[offset:offset+length*(1 if compressed else 2)].decode('cp1252' if compressed else 'utf-16-le', errors='replace'))
    return ''.join(parts).replace('\r','\n').replace('\x07','\t')

out = Path(__file__).resolve().parent.parent / 'reports/proficiency-audit'
scratch = Path('C:/Users/Daniel José/.gemini/antigravity-ide/brain/b6028f87-e7db-4922-ba38-eb6cf62869c1/scratch')
sources, errors = [], []
for i, t in enumerate(json.loads((scratch / 'transcripts.json').read_text(encoding='utf-8'))):
    if t.get('fullTranscript'):
        # Character offsets are stable against the captured transcript hash.
        text = t['fullTranscript']
        for start in range(0, len(text), 1800):
            sources.append(dict(id=f'T{i:03d}:{start}', kind='transcript', file=str(scratch / 'transcripts.json'), courseId=t['courseId'], title=t['courseTitle'] + ' — ' + t['lessonTitle'], location=f'caracteres {start}-{min(start+2100,len(text))}', text=text[start:start+2100]))
for p in Path('Y:/Treinamento Interno - CQ').rglob('*'):
    if not p.is_file() or p.name.startswith('~$') or p.suffix.lower() not in ('.pdf', '.docx', '.doc'):
        continue
    try:
        digest = hashlib.sha256(p.read_bytes()).hexdigest()
        if p.suffix.lower() == '.pdf':
            for n, page in enumerate(PdfReader(io.BytesIO(p.read_bytes())).pages, 1):
                text = page.extract_text() or ''
                sources.append(dict(id=f'M{len(sources):04d}', kind='manual', file=str(p), title=p.name, location=f'página {n}', sha256=digest, text=text))
        elif p.suffix.lower() == '.docx':
            with zipfile.ZipFile(p) as z:
                tree = ET.fromstring(z.read('word/document.xml'))
            ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
            paragraphs = [''.join(t.text or '' for t in e.findall('.//w:t',ns)) for e in tree.findall('.//w:p',ns)]
            for n in range(0,len(paragraphs),12):
                sources.append(dict(id=f'M{len(sources):04d}', kind='manual', file=str(p), title=p.name, location=f'parágrafos {n+1}-{min(n+12,len(paragraphs))}', sha256=digest, text='\n'.join(paragraphs[n:n+12])))
        else:
            text = read_doc(p)
            for n in range(0,len(text),1800):
                sources.append(dict(id=f'M{len(sources):04d}', kind='manual', file=str(p), title=p.name, location=f'caracteres {n}-{min(n+2100,len(text))}', sha256=digest, text=text[n:n+2100]))
        print('Lido: '+p.name, flush=True)
    except Exception as e:
        errors.append(dict(file=str(p), reason=str(e)))
(out/'evidence.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
(out/'extraction-errors.json').write_text(json.dumps(errors, ensure_ascii=False, indent=2), encoding='utf-8')
snapshot = json.loads((out/'snapshot.json').read_text(encoding='utf-8'))
titles = {r['id']:(r.get('published') or r.get('draft'))['title'] for r in snapshot['resources']}
lines = []
for bank in snapshot['banks']:
    lines.append('\nFILE '+bank['file'])
    for cid, qs in bank['bank'].items():
        lines.append('\nCOURSE '+cid+' '+titles.get(cid,'?'))
        for n,q in enumerate(qs,1):
            lines.append(f"{n:02d}. {q['prompt']}\nCORRECT: {q['correct']}\nWRONG: "+' | '.join(x for x in q['options'] if x!=q['correct']))
(out/'questions-readable.txt').write_text('\n'.join(lines), encoding='utf-8')
print(json.dumps(dict(sources=len(sources),manualFiles=len(set(s['file'] for s in sources if s['kind']=='manual')),unread=len(errors)),ensure_ascii=False))
