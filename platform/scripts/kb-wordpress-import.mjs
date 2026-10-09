// WXR inventory and resumable import. Destination is exclusively a local pilot.
import { readFile, writeFile, mkdir, copyFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { parseDocument } from 'htmlparser2';
import { textContent } from 'domutils';
import sharp from 'sharp';
import { normalizeImportedDocument, historicalMetadata } from './kb-wordpress-review.mjs';

const folder = path.resolve('.kb-pilot/wordpress-100');
const origin = 'https://bc.demaria.com.br';
const mode = process.argv[2] || 'inventory';
const input = process.argv[3];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = v => Array.isArray(v) ? v.map(canonical) : v && typeof v==='object' ? Object.fromEntries(Object.keys(v).sort().filter(k=>v[k]!==undefined).map(k=>[k,canonical(v[k])])) : v;
const documentHash = d => hash(JSON.stringify(canonical(d)));
const json = async file => JSON.parse(await readFile(path.join(folder, file), 'utf8'));
const put = async (file, value) => writeFile(path.join(folder, file), JSON.stringify(value, null, 2));
const children = (node, name) => (node.children || []).filter(n => n.name === name);
const value = (node, name) => children(node, name).map(textContent).join('');
const all = node => [node, ...(node.children || []).flatMap(all)];
const plain = html => textContent(parseDocument(html)).replace(/\s|\u00a0/g, '');
const normalizeUrl = source => {
  if (/^(?:data:)?image\/(png|jpeg|webp);base64,/i.test(source)) return `${origin}/wp-content/uploads/academy-inline-${hash(source)}.${source.match(/image\/(\w+)/i)[1]}`;
  const u = new URL(source, origin);
  const attachment = u.hostname === 'demaria.com.br' && /^\/wp-content\/uploads\/.*\.pdf$/i.test(u.pathname);
  const external = (u.hostname==='i.postimg.cc'&&/^\/[a-zA-Z0-9]+\//.test(u.pathname)) || (u.hostname==='cdn.discordapp.com'&&u.pathname.startsWith('/attachments/')) || (u.hostname==='s3-sa-east-1.amazonaws.com'&&u.pathname.startsWith('/contako/ImagensClientes/')) || (['cnbsp.org.br','www.notariado.org.br'].includes(u.hostname)&&u.pathname.startsWith('/wp-content/uploads/'));
  if ((!attachment && !external && u.hostname !== 'bc.demaria.com.br') || u.username || u.password || u.port || !['http:', 'https:'].includes(u.protocol)) throw Error('Origem externa: revisão necessária');
  u.protocol = 'https:';
  if(external){u.hash='';return u.href;}
  if ((!attachment && u.origin !== origin) || !u.pathname.startsWith('/wp-content/uploads/')) throw Error('Arquivo fora de uploads');
  u.hash = ''; return u.href;
};
const converterSource = source => {
  try { const url=normalizeUrl(source);if(new URL(url).origin===origin)return url; } catch {}
  return `${origin}/wp-content/uploads/academy-external-${hash(source)}.png`;
};
await mkdir(path.join(folder, 'assets'), { recursive: true });

if (mode === 'inventory') {
  if (!input) throw Error('Informe o XML WXR.');
  const bytes = await readFile(input);
  if (/<!DOCTYPE|<!ENTITY/i.test(bytes.toString())) throw Error('Declarações XML externas não permitidas.');
  const tree = parseDocument(bytes.toString('utf8'), { xmlMode: true, decodeEntities: true });
  const channel = all(tree).find(n => n.name === 'channel');
  if (!channel || !value(channel, 'wp:wxr_version')) throw Error('WXR inválido.');
  const source = value(channel, 'wp:base_site_url');
  if (new URL(source).origin !== origin) throw Error('Site de origem divergente.');
  const authors = Object.fromEntries(children(channel, 'wp:author').map(n => [value(n, 'wp:author_login'), value(n, 'wp:author_display_name')]));
  const items = children(channel, 'item').filter(n => value(n, 'wp:post_type') === 'ht_kb');
  const eligible = items.filter(n => ['publish', 'private'].includes(value(n, 'wp:status')))
    .sort((a, b) => value(b, 'wp:post_date').localeCompare(value(a, 'wp:post_date')) || Number(value(b, 'wp:post_id')) - Number(value(a, 'wp:post_id'))).slice(0, Number(process.env.KB_IMPORT_LIMIT || 100));
  if (!eligible.length) throw Error('Origem não contém artigos elegíveis.');
  const records = eligible.map(n => {
    const html = value(n, 'content:encoded'), nodes = all(parseDocument(html));
    const media = nodes.filter(n => n.name === 'img').map(n => ({ source: n.attribs.src || '', alt: n.attribs.alt || '', srcset: n.attribs.srcset || '', width: n.attribs.width, height: n.attribs.height }));
    const links = nodes.filter(n => n.name === 'a').map(n => n.attribs.href).filter(Boolean);
    const attachments = links.filter(v => /\/wp-content\/uploads\//i.test(v) && /\.(pdf|zip|sql|xlsx?|docx?|txt)(?:[?#]|$)/i.test(v));
    const customFields = children(n, 'wp:postmeta').map(m => ({ key: value(m, 'wp:meta_key'), value: value(m, 'wp:meta_value') }));
    return { sourceKey: `${origin}|${value(n, 'wp:post_id')}`, wpId: value(n, 'wp:post_id'), title: value(n, 'title'), url: value(n, 'link'), slug: value(n, 'wp:post_name'), status: value(n, 'wp:status'), visibility: value(n, 'wp:status') === 'private' ? 'private' : 'public', published: value(n, 'wp:post_date'), publishedGmt: value(n, 'wp:post_date_gmt'), modified: value(n, 'wp:post_modified'), authorLogin: value(n, 'dc:creator'), authorName: authors[value(n, 'dc:creator')] || null, taxonomies: children(n, 'category').map(c => ({ domain: c.attribs.domain, slug: c.attribs.nicename, name: textContent(c) })), customFields, html, sourceHash: hash(html), media, attachments, links, unsupported: [...new Set(nodes.filter(n => ['iframe', 'video', 'audio', 'object', 'embed', 'script', 'style'].includes(n.name)).map(n => n.name))], shortcodes: [...html.matchAll(/\[(?:pdf-embedder|yotuwp|gallery|video|audio|embed|vc_[\w]+)[^\]]*\]/gi)].map(m => m[0]) };
  });
  const manifest = { source, xmlHash: hash(bytes), selectedAt: new Date().toISOString(), sourceArticleCount: items.length, records };
  const existing = await json('manifest.json').catch(() => null);
  if (existing && existing.xmlHash !== manifest.xmlHash) throw Error('Lote já fixado com outro XML; não sobrescrito.');
  if (existing && existing.records.some((r,i)=>records[i]?.sourceKey!==r.sourceKey||records[i]?.sourceHash!==r.sourceHash)) throw Error('Seleção anterior divergente; não sobrescrita.');
  if (existing && records.length>existing.records.length) await copyFile(path.join(folder,'manifest.json'),path.join(folder,`manifest-${existing.records.length}.json`));
  await put('manifest.json', manifest);
  if (!existing) await copyFile(input, path.join(folder, 'source.xml'));
  console.log(JSON.stringify({ selected: records.length, public: records.filter(r => r.visibility === 'public').length, private: records.filter(r => r.visibility === 'private').length, imageOccurrences: records.reduce((s, r) => s + r.media.length, 0), uniqueImageUrls: new Set(records.flatMap(r => r.media.map(m => m.source))).size, attachmentOccurrences: records.reduce((s, r) => s + r.attachments.length, 0), unsupportedArticles: records.filter(r => r.unsupported.length || r.shortcodes.length).length }));
} else if (mode === 'assets') {
  const { records } = await json('manifest.json');
  const media = [...new Set(records.flatMap(r => [...r.media.map(m => m.source), ...r.attachments]))];
  const results = {};
  let previous = await json('assets.json').catch(() => ({}));
  const download = async source => {
    try {
      const url = normalizeUrl(source), filename = `assets/${hash(url)}`;
      const old = previous[source];
      if (old?.status === 'ready' && hash(await readFile(path.join(folder, old.file))) === old.checksum) { results[source] = old; return; }
      const embedded = /^(?:data:)?image\/(png|jpeg|webp);base64,/i.test(source);
      const response = embedded ? null : await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(25000) });
      if (response && !response.ok) throw Error(`HTTP ${response.status}`);
      const parts = []; let size = 0;
      if (embedded) { const encoded=source.slice(source.indexOf(',')+1);if(encoded.length>28000000||!/^[a-zA-Z0-9+/=\s]+$/.test(encoded))throw Error('Base64 inválido ou muito grande');const decoded=Buffer.from(encoded,'base64');parts.push(decoded);size=decoded.length; }
      else for await (const part of response.body) { size += part.length; if (size > 20 * 1024 * 1024) throw Error('Arquivo acima de 20 MB; revisão necessária'); parts.push(part); }
      const bytes = Buffer.concat(parts), image = records.some(r => r.media.some(m => m.source === source));
      if (!image && !bytes.subarray(0,5).equals(Buffer.from('%PDF-'))) throw Error('Anexo não é um PDF válido');
      let meta = null;
      if (image) { meta = await sharp(bytes, { limitInputPixels: 40000000 }).metadata(); if (!['png', 'jpeg', 'webp'].includes(meta.format) || meta.pages > 1 || size > 5242880) throw Error('Imagem incompatível com o upload atual'); }
      await writeFile(path.join(folder, filename), bytes);
      results[source] = { status: 'ready', url, file: filename, bytes: size, checksum: hash(bytes), mime: image ? ({ png: 'image/png', jpeg: 'image/jpeg', webp: 'image/webp' })[meta.format] : response.headers.get('content-type'), width: meta?.width, height: meta?.height, image };
    } catch (e) { results[source] = { status: 'pending', error: e.message }; }
  };
  for (let i = 0; i < media.length; i += 4) { await Promise.all(media.slice(i, i + 4).map(download)); await put('assets.json', { ...previous, ...results }); if (i % 40 === 0) console.log(`Mídias verificadas: ${Math.min(i + 4, media.length)}/${media.length}`); }
  console.log(JSON.stringify({ uniqueReady: Object.values(results).filter(r => r.status === 'ready').length, pending: Object.values(results).filter(r => r.status !== 'ready').length, uniqueBytes: Object.values(results).reduce((s, r) => s + (r.bytes || 0), 0) }));
} else if (['import', 'verify', 'review', 'origin'].includes(mode)) {
  const base = 'http://127.0.0.1:4176';
  const actor = '11111111-1111-4111-8111-111111111111';
  const api = async (url, body, authenticated = true) => {
    const r = await fetch(base + url, { method: body ? 'POST' : 'GET', headers: { ...(authenticated ? { Cookie: `kb-pilot=${actor}` } : {}), ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}) }, body: body ? body instanceof FormData ? body : JSON.stringify(body) : undefined });
    const data = await r.json(); if (!r.ok) throw Error(`${r.status}: ${data.error}`); return data;
  };
  const list = await api('/api/kb?editorial=1');
  if (list.me?.name !== 'Autor piloto' || list.me?.id !== actor) throw Error('Destino não é piloto local.');
  const destinationSlugs=new Set(list.articles.map(a=>a.slug));
  if(mode==='import')for(let page=2;page<=50;page++){const data=await api(`/api/kb?editorial=1&pagina=${page}`);data.articles.forEach(a=>destinationSlugs.add(a.slug));if(data.articles.length<20)break;}
  const { records } = await json('manifest.json'), assets = await json('assets.json');
  const progress = await json('progress.json').catch(() => ({}));
  const previousPilot = JSON.parse(await readFile('.kb-pilot/import-report.json', 'utf8').catch(() => '{"results":[]}')).results;
  const report = [];
  const limit = Number(process.env.KB_IMPORT_LIMIT || records.length);
  const selected = process.env.KB_IMPORT_SAMPLE === '1' ? [...new Set([records.find(r => r.visibility === 'public'), records.find(r => r.visibility === 'private'), [...records].sort((a,b) => b.html.length-a.html.length)[0], [...records].sort((a,b) => b.media.length-a.media.length)[0], records.find(r => r.attachments.length)])].filter(Boolean) : records.slice(0, limit);
  for (const record of selected) {
    let p = progress[record.sourceKey];
    try {
      if (p && p.sourceHash !== record.sourceHash) throw Error('Conflito: conteúdo de origem mudou.');
      if(mode==='origin'){
        if(!p?.articleId)throw Error('Artigo não importado');
        const raw=record.customFields.find(f=>f.key==='_ht_kb_post_views_count')?.value;
        if(raw!==undefined&&!/^\d+$/.test(raw))throw Error('Contador inválido');
        const views=raw===undefined?null:Number(raw);if(views!==null&&!Number.isSafeInteger(views))throw Error('Contador muito grande');
        await api('/api/kb/origin',{articleId:p.articleId,wpId:Number(record.wpId),author:record.authorName||record.authorLogin,created:record.published,createdGmt:record.publishedGmt,modified:record.modified,views});
        report.push({wpId:record.wpId,articleId:p.articleId,author:record.authorName||record.authorLogin,created:record.published,modified:record.modified,views});continue;
      }
      if (p?.documentHash) {
        const stored = await json(`article-${record.wpId}.json`);
        if (p.documentHash === hash(JSON.stringify(stored.converted))) p.documentHash=documentHash(stored.converted);
      }
      if ((p?.complete && process.env.KB_IMPORT_REFRESH !== '1' && mode !== 'review') || mode === 'verify' || mode === 'review') {
        if (!p?.articleId) { report.push({ wpId: record.wpId, status: 'not-imported' }); continue; }
        const saved = await api(`/api/kb/articles/${p.articleId}`);
        if (documentHash(saved.document) !== p.documentHash || saved.status !== 'draft' || saved.proposed_visibility !== 'private' || saved.publication) throw Error('Destino alterado ou não restrito.');
        if(mode==='review'){
          const d=saved.document;Object.assign(d.metadata,historicalMetadata(record));
          const reviewed=normalizeImportedDocument(d,record);
          await api('/api/kb',{action:'save',articleId:p.articleId,expectedVersion:saved.version,document:d,visibility:'private'});
          Object.assign(p,{documentHash:documentHash(d),historical:historicalMetadata(record),editorialReview:reviewed.pending,normalizations:[...new Set([...p.normalizations,...reviewed.changes])]});
          await put(`article-${record.wpId}.json`,{source:record,converted:d,result:p});await put('progress.json',progress);
        }
        report.push({ ...p, wpId: record.wpId, status: p.complete ? 'verified-existing' : 'pending' }); continue;
      }
      let html = record.html.replace(/http:\/\/bc\.demaria\.com\.br\//gi, `${origin}/`);
      for (const media of record.media) html=html.split(media.source.replace(/http:\/\/bc\.demaria\.com\.br\//gi,`${origin}/`)).join(converterSource(media.source));
      // Preserve the entire historical body; metadata is sourced separately from WXR.
      // Wrapping prevents the heuristic legacy header parser from dropping uncommon headings.
      const compatibilityPending=[];
      let converted;
      try { converted = await api('/api/kb/import', { html: `<div>${html}</div>` }); }
      catch(e) {
        if (!e.message.includes('Estrutura rica inválida') || !/<hr\b/i.test(html)) throw e;
        html=html.replace(/<hr\b[^>]*>/gi,'<p>────────</p>');
        converted=await api('/api/kb/import',{html:`<div>${html}</div>`});
        compatibilityPending.push('Separadores horizontais em listas convertidos em linha textual; revisar formatação. Original preservado.');
      }
      const d = converted.document;
      const body = d.sections.flatMap(s => s.content.content || []);
      d.templateVersion = 2; d.sections = [{ ...d.sections[0], key: 'conteudo', content: { type: 'doc', content: body } }];
      d.metadata.title = record.title;
      const categories = record.taxonomies.filter(t => t.domain === 'ht_kb_category');
      d.metadata.category = categories[0]?.name || '';
      d.metadata.tags = record.taxonomies.filter(t => t.domain === 'ht_kb_tag').map(t => t.name).slice(0, 20);
      const sourceNodes = all(parseDocument(html));
      const texts = sourceNodes.filter(n => n.name === 'p').map(textContent);
      d.metadata.product = (texts.find(t => /^Software a que se aplica este artigo:/i.test(t.trim())) || '').replace(/^\s*Software a que se aplica este artigo:\s*/i, '').trim().slice(0, 120);
      Object.assign(d.metadata, historicalMetadata(record));
      d.metadata.summary = (texts.find(t => t.trim() && !/^(Data da |Software a que|Implementado na|Passo a passo)/i.test(t.trim()) && t.trim() !== record.title) || '').trim().slice(0, 2000);
      const pending = [...compatibilityPending, ...record.unsupported.map(t => `Recurso não convertido: ${t}`), ...record.shortcodes.map(t => `Shortcode: ${t}`), ...record.attachments.map(t => `Anexo preservado na origem; integração editorial pendente: ${t}`)];
      const richText = n => n.text || (n.content || []).map(richText).join('');
      if (plain(html) !== richText(d.sections[0].content).replace(/\s|\u00a0/g, '')) pending.push('Diferença textual na conversão');
      if (converted.media.length !== record.media.length) pending.push('Contagem de imagens divergente');
      if (record.links.some(l => /^http:/i.test(l) && !/^http:\/\/bc\.demaria\.com\.br\//i.test(l))) pending.push('Links HTTP externos exigem revisão');
      const review = normalizeImportedDocument(d, record);
      const slug = `wordpress-${record.wpId}`;
      if (!p) {
        if (destinationSlugs.has(slug)) throw Error('Slug existente sem registro de progresso; revisão necessária');
        const created = await api('/api/kb', { action: 'create', slug, document: d });
        destinationSlugs.add(slug);
        p = progress[record.sourceKey] = { sourceHash: record.sourceHash, articleId: created.id, media: {}, complete: false };
        await put('progress.json', progress);
      }
      for (const media of converted.media) {
        if (p.media[media.id]) continue;
        const source = record.media.find(m => converterSource(m.source) === media.source)?.source;
        const asset = assets[source];
        if (asset?.status !== 'ready') { pending.push(`Imagem pendente: ${source && source.length<2000?source:media.source}`); continue; }
        const bytes = await readFile(path.join(folder, asset.file));
        if (hash(bytes) !== asset.checksum) throw Error('Cache de mídia divergente');
        const form = new FormData(); form.set('articleId', p.articleId); form.set('file', new Blob([bytes], { type: asset.mime }), path.basename(new URL(asset.url).pathname));
        const stored = await api('/api/kb/media', form); p.media[media.id] = stored.id; await put('progress.json', progress);
      }
      const walk = n => { if(n.type==='image'){if(p.media[n.attrs.mediaId])n.attrs.mediaId=p.media[n.attrs.mediaId];else{const blockId=n.attrs.blockId;n.type='paragraph';n.attrs={blockId};n.content=[{type:'text',text:'Imagem pendente de recuperação; original preservado para revisão.'}];}} n.content?.forEach(walk); };
      d.sections.forEach(s => walk(s.content));
      const current = await api(`/api/kb/articles/${p.articleId}`);
      if (p.documentHash && documentHash(current.document) !== p.documentHash) throw Error('Rascunho alterado após importação; revisão necessária');
      await api('/api/kb', { action: 'save', articleId: p.articleId, expectedVersion: current.version, document: d, visibility: 'private' });
      await api('/api/kb/import', { html: `<div>${html}</div>`, articleId: p.articleId }).catch(e => pending.push(`Registro HTML na API pendente: ${e.message}`));
      const old = previousPilot.find(r => r.sourceHash === record.sourceHash || record.title.toLowerCase().startsWith(r.source?.replace(/\.txt$/i, '').toLowerCase()));
      Object.assign(p, { documentHash: documentHash(d), complete: pending.length === 0, pending, sourceVisibility: record.visibility, previousPilotMatch: old?.articleId || null, normalizations: [...converted.report,...review.changes], editorialReview: review.pending, historical: historicalMetadata(record) });
      await put(`article-${record.wpId}.json`, { source: record, converted: d, result: p });
      await put('progress.json', progress);
      report.push({ ...p, wpId: record.wpId, status: p.complete ? 'imported-local' : 'pending' });
    } catch (e) { report.push({ wpId: record.wpId, articleId: p?.articleId, status: 'error', error: e.message }); }

  await put('report.json', report);
    console.log(`${report.length}/${limit}: ${record.wpId} ${report.at(-1).status}`);
  }
    if(mode==='origin'){await put('origin-report.json',report);console.log(JSON.stringify({updated:report.filter(r=>!r.error).length,errors:report.filter(r=>r.error).length,legacyViews:report.reduce((n,r)=>n+(r.views||0),0),missing:report.filter(r=>r.views===null).map(r=>r.wpId)}));process.exit(report.some(r=>r.error)?1:0);}
  const checks = [];
  if(process.env.KB_IMPORT_SKIP_CHECKS==='1'&&mode!=='verify'){await put('report.json',report);console.log(JSON.stringify({processed:report.length,complete:report.filter(r=>r.complete).length,pending:report.filter(r=>r.status==='pending').length,errors:report.filter(r=>r.status==='error').length}));process.exit(0);}
  for (const r of report.filter(r => r.articleId)) {
    const article = await fetch(`${base}/api/kb/articles/${r.articleId}`);
    checks.push({ type: 'anonymous-article', wpId: r.wpId, status: article.status, pass: [403, 404].includes(article.status) });
    const sourceRecord=records.find(item=>item.wpId===r.wpId);
    for (const [sourceId,id] of Object.entries(r.media || {})) {
      const response = await fetch(`${base}/api/kb/media/${id}`); checks.push({ type: 'anonymous-media', wpId: r.wpId, status: response.status, pass: [403, 404].includes(response.status) });
      const source=sourceRecord.media.find(m=>{
        return [converterSource(m.source),m.source.replace(/http:\/\/bc\.demaria\.com\.br\//gi,`${origin}/`)].some(source=>{const h=hash(source);return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`===sourceId;});
      })?.source;
      let authenticated=await fetch(`${base}/api/kb/media/${id}`,{headers:{Cookie:`kb-pilot=${actor}`}});
      const attempts=[authenticated.status];
      while(authenticated.status>=500&&attempts.length<3){await authenticated.arrayBuffer();authenticated=await fetch(`${base}/api/kb/media/${id}`,{headers:{Cookie:`kb-pilot=${actor}`}});attempts.push(authenticated.status);}
      const actual=Buffer.from(await authenticated.arrayBuffer());
      checks.push({type:'authenticated-media-integrity',wpId:r.wpId,mediaId:id,status:authenticated.status,attempts,pass:authenticated.ok&&assets[source]?.checksum===hash(actual)});
    }
  }
  const search = await api('/api/kb', null, false);
  checks.push({ type: 'public-search-empty', pass: search.results.length === 0 });
  await put('checks.json', checks); await put('report.json', report);
  const summary = { selected: records.length, processed: report.length, complete: report.filter(r => r.complete).length, pending: report.filter(r => r.status === 'pending').length, errors: report.filter(r => r.status === 'error').length, previousPilotMatches: report.filter(r => r.previousPilotMatch).length, uniqueAssetBytes: Object.values(assets).reduce((s, r) => s + (r.bytes || 0), 0), accessChecks: checks.length, accessFailures: checks.filter(c => !c.pass).length, sourceVisibility: { public: records.filter(r => r.visibility === 'public').length, private: records.filter(r => r.visibility === 'private').length } };
  await put('summary.json', summary); console.log(JSON.stringify(summary));
} else throw Error('Use inventory, assets, import, review ou verify.');
