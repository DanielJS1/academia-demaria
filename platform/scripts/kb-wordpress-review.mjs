import { parseDocument } from 'htmlparser2';
import { textContent } from 'domutils';
import { randomUUID } from 'node:crypto';

const text = n => n.text || (n.content || []).map(text).join(' ');
const nonempty = n => n.type === 'image' || n.type === 'horizontalRule' || text(n).trim() || (n.content || []).some(nonempty);
const clean = s => s.replace(/\s+/g,' ').trim();

export function historicalMetadata(record) {
  const nodes = parseDocument(record.html.replace(/<br\s*\/?\s*>/gi,'\n'));
  const paragraphs = n => n.name==='p'?[textContent(n)]:(n.children||[]).flatMap(paragraphs);
  const lines = [...paragraphs(nodes),textContent(nodes)].flatMap(s=>s.split(/[\r\n]+/)).map(clean).filter(Boolean);
  const revision = lines.find(l=>/^Data d[ae] (?:última )?revisão\s*:/i.test(l));
  const stated=lines.find(l=>/^Data d[ae] publicação\s*:/i.test(l))?.replace(/^Data d[ae] publicação\s*:\s*/i,'').split(/Data d[ae] (?:última )?revisão/i)[0].replace(/\(\s*(?:Texto\s+)?fonte\s+Calibri\s+\d+(?:px|pt)?\s*\)/gi,'').trim();
  const date = record.published?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const publication = date ? `${date[3]}/${date[2]}/${date[1]}` : record.published;
  const author = record.authorName || record.authorLogin;
  return {
    legacyPublished: clean(`${stated?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] || publication || ''}${author ? ` · Autor: ${author}` : ''}`).slice(0,120) || null,
    legacyRevision: revision?.replace(/^Data d[ae] (?:última )?revisão\s*:\s*/i,'').slice(0,240) || null,
  };
}

// Only empty bullet wrappers are flattened. Ordered lists retain their numbering.
// Text and image order remain unchanged; no technical content is generated.
export function normalizeImportedDocument(document, record) {
  const changes=[], pending=[];
  const typographyNotes=/\(\s*(?:Texto\s+)?fonte\s+Calibri\s+\d+(?:px|pt)?\s*\)/gi;
  const notes=n=>{if(n.type==='text'&&typographyNotes.test(n.text)){n.text=n.text.replace(typographyNotes,'');changes.push('Orientação de fonte do template antigo removida do texto visível.');}typographyNotes.lastIndex=0;n.content?.forEach(notes);};
  document.metadata.product=document.metadata.product.replace(typographyNotes,'').trim();
  const walk = n => {
    if(n.type==='text'&&!n.text)return [];
    if (!n.content) return [n];
    n.content=n.content.flatMap(walk);
    if (n.type==='doc') n.content=n.content.filter(nonempty);
    if (n.type==='bulletList') {
      const output=[];let group=[];
      const flush=()=>{if(group.length){output.push({...n,...(output.length&&n.attrs?{attrs:{...n.attrs,blockId:randomUUID()}}:{}),content:group});group=[];}};
      for(const item of n.content){
        const content=(item.content || []).filter(nonempty);
        if(!content.length){changes.push('Marcador vazio removido.');continue;}
        if(content.every(c=>['bulletList','image'].includes(c.type))){
          changes.push('Contêiner de lista sem texto removido, preservando subitens e imagens.');
          for(const c of content){if(c.type==='bulletList')group.push(...c.content);else{flush();output.push(c);}}
          continue;
        }
        item.content=content[0]?.type==='paragraph'?content:[{type:'paragraph',...(item.attrs?.blockId?{attrs:{blockId:randomUUID()}}:{})},...content];
        group.push(item);
      }
      flush();return output;
    }
    return [n];
  };
  let context='', imageIndex=0;
  const descriptions = n => {
    if(['paragraph','heading'].includes(n.type)&&text(n).trim()) context=clean(text(n));
    if(n.type==='image') {
      const source=record.media[imageIndex++];
      if(n.attrs.alt.trim())return;
      n.attrs.alt=/\/logo(?:[.\-_]|\/)/i.test(source?.source||'') ? 'Logo DeMaria' : context && !/^Data d[ae]|^Software a que|^Implementado na/i.test(context)
        ? `Captura de tela relacionada a: ${context}`.slice(0,500)
        : `Imagem do artigo: ${record.title}`.slice(0,500);
      changes.push('Descrição alternativa gerada a partir do contexto textual; conferir editorialmente.');
    }
    n.content?.forEach(descriptions);
  };
  document.sections.forEach(s=>{notes(s.content);descriptions(s.content);walk(s.content);const first=s.content.content?.findIndex(n=>text(n).trim());if(first>=0&&['paragraph','heading'].includes(s.content.content[first].type)&&clean(text(s.content.content[first])).toLowerCase()===clean(record.title).toLowerCase()){s.content.content.splice(first,1);changes.push('Título duplicado no corpo removido; título preservado no cabeçalho institucional.');}});
  const intro=document.sections[0].content.content?.find(n=>n.type==='paragraph'&&text(n).trim()&&!/^(Data da (publicação|última revisão):|Software a que se aplica este artigo:|Implementado na versão\/release:)/i.test(text(n).trim()));
  document.metadata.summary=clean(intro?text(intro):text(document.sections[0].content)).slice(0,2000);
  if(!document.metadata.product.trim())pending.push('Produto ausente na origem: preencher antes de publicar.');
  const wpDate=record.published?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const historical=document.metadata.legacyPublished?.match(/\d{2}\/\d{2}\/\d{4}/)?.[0];
  if(wpDate&&historical&&historical!==`${wpDate[3]}/${wpDate[2]}/${wpDate[1]}`)pending.push('Data declarada no artigo difere da data do WordPress: ambas preservadas; confirmar antes de publicar.');
  pending.push('Validar atualidade técnica, descrições das imagens e cabeçalho histórico antes de publicar.');
  if(record.visibility==='private')pending.push('Artigo originalmente privado: manter privado; publicidade depende de avaliação específica.');
  return {changes:[...new Set(changes)],pending:[...new Set(pending)]};
}
