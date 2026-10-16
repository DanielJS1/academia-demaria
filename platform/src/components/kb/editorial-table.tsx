"use client";
import Link from "next/link";
import { Trash2,RotateCcw } from "lucide-react";
export type EditorialRow={id:string;slug:string;title:string;author_name:string;status:string;version:number;owner_id:string;created_at:string;updated_at:string;category:string;tags:string[];can_edit:boolean;views_total?:number|null;origin_views?:number|null;new_views?:number};
export const statusLabels:Record<string,string>={draft:"Rascunho",review:"Em revisão",changes:"Ajustes solicitados",published:"Publicado",archived:"Arquivado",deleted:"Na lixeira"};
const date=(value:string)=>new Date(value).toLocaleString("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"short",timeStyle:"short"});
export function EditorialTable({rows,busy,onOpen,onTrash}:{rows:EditorialRow[];busy:boolean;onOpen:(id:string)=>void;onTrash:(row:EditorialRow,restore?:boolean)=>void}){
 return <div className="kb-editorial-table"><table aria-label="Artigos da Base de Conhecimento"><thead><tr><th>Título</th><th>Autor</th><th>Status</th><th>Categoria</th><th aria-sort="descending">Criado em <span aria-hidden="true">↓</span></th><th>Visualizações</th><th>Ações</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}>
  <td data-label="Título">{r.can_edit&&r.status!=="deleted"?<button className="kb-article-title" disabled={busy} onClick={()=>onOpen(r.id)}>{r.title||"Artigo sem título"}</button>:r.status==="published"?<Link className="kb-article-title" href={`/conhecimento/base/${r.slug}`}>{r.title||"Artigo sem título"}</Link>:<strong>{r.title||"Artigo sem título"}</strong>}{r.tags?.length?<small className="kb-table-tags">{r.tags.join(" · ")}</small>:null}</td>
  <td data-label="Autor">{r.author_name}</td><td data-label="Status"><span className={`kb-status kb-status-${r.status}`}>{statusLabels[r.status]||r.status}</span></td><td data-label="Categoria">{r.category||"—"}</td>
  <td data-label="Criado em"><time dateTime={r.created_at}>{date(r.created_at)}</time>{r.updated_at!==r.created_at&&<small>Editado: {date(r.updated_at)}</small>}</td>
  <td data-label="Visualizações" title={`WordPress: ${r.origin_views??"desconhecido"} · Academia: ${r.new_views??0}`}>{r.views_total==null?"Histórico indisponível":r.views_total.toLocaleString("pt-BR")}</td>
  <td data-label="Ações"><button className={r.status==="deleted"?"":"kb-table-delete"} disabled={busy||!r.can_edit} title={!r.can_edit?"Apenas o autor e a administração podem alterar este artigo":undefined} onClick={()=>onTrash(r,r.status==="deleted")}>{r.status==="deleted"?<RotateCcw size={15}/>:<Trash2 size={15}/>}<span>{r.status==="deleted"?"Restaurar":"Excluir"}</span></button></td>
 </tr>)}</tbody></table>{!rows.length&&<p className="kb-table-empty">Nenhum artigo encontrado neste filtro.</p>}</div>;
}
