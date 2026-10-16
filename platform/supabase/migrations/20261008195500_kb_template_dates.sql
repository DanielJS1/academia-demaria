-- Adds 12px dates to the institutional article template.
create or replace function kb_private.validate_node(n jsonb, level integer default 0) returns void language plpgsql immutable set search_path='' as $$
declare c jsonb; m jsonb; k text; typ text := n->>'type'; allowed text[]; child_types text[];
begin
 if level>32 or jsonb_typeof(n) is distinct from 'object' or typ is null or typ not in ('doc','text','paragraph','heading','bulletList','orderedList','listItem','blockquote','codeBlock','hardBreak','horizontalRule','image','table','tableRow','tableCell','tableHeader') then raise exception 'Invalid rich node'; end if;
 if n ? 'content' and (jsonb_typeof(n->'content') is distinct from 'array' or jsonb_array_length(n->'content')>2000) then raise exception 'Invalid content'; end if;
 if n ? 'marks' and (jsonb_typeof(n->'marks') is distinct from 'array' or jsonb_array_length(n->'marks')>8) then raise exception 'Invalid marks'; end if;
 if exists(select 1 from jsonb_object_keys(n) key where key not in ('type','text','content','attrs','marks')) then raise exception 'Invalid node fields'; end if;
 allowed := case typ when 'image' then array['mediaId','alt','width','height','textAlign'] when 'paragraph' then array['textAlign'] when 'heading' then array['level','textAlign'] when 'orderedList' then array['start','type'] when 'codeBlock' then array['language'] when 'tableCell' then array['colspan','rowspan','colwidth'] when 'tableHeader' then array['colspan','rowspan','colwidth'] else array[]::text[] end;
 if n ? 'attrs' then
  if jsonb_typeof(n->'attrs')<>'object' then raise exception 'Invalid attrs'; end if;
  for k in select jsonb_object_keys(n->'attrs') loop
   if (not k=any(allowed) and not(k='blockId' and typ not in ('doc','text','hardBreak'))) or jsonb_typeof(n->'attrs'->k) not in ('string','number','null') then raise exception 'Invalid attrs'; end if;
   if jsonb_typeof(n->'attrs'->k)='string' and length(n->'attrs'->>k)>2000 then raise exception 'Invalid attrs'; end if;
   if k='textAlign' and n->'attrs'->>k is not null and n->'attrs'->>k not in ('left','center','right','justify') then raise exception 'Invalid text alignment'; end if;
   if k='blockId' and n->'attrs'->>k is not null and n->'attrs'->>k !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then raise exception 'Invalid block id'; end if;
   if k in ('width','height','colspan','rowspan') and ((n->'attrs'->>k)::numeric not between 1 and 10000 or trunc((n->'attrs'->>k)::numeric)<>(n->'attrs'->>k)::numeric) then raise exception 'Invalid dimension'; end if;
  end loop;
 end if;
 if typ='image' and n->'attrs'->>'textAlign'='justify' then raise exception 'Invalid image alignment'; end if;
 if typ='heading' and coalesce(n->'attrs'->>'level','') not in ('2','3','4') then raise exception 'Invalid heading'; end if;
 if typ='image' and (coalesce(n->'attrs'->>'mediaId','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' or jsonb_typeof(n->'attrs'->'alt') is distinct from 'string') then raise exception 'Invalid image'; end if;
 if typ='text' and (jsonb_typeof(n->'text') is distinct from 'string' or length(n->>'text')=0 or length(n->>'text')>100000 or n ? 'content') then raise exception 'Invalid text'; end if;
 if typ<>'text' and n ? 'text' then raise exception 'Invalid text'; end if;
 for m in select value from jsonb_array_elements(coalesce(n->'marks','[]')) loop
  if jsonb_typeof(m) is distinct from 'object' or coalesce(m->>'type','') not in ('bold','italic','strike','underline','code','link','subscript','superscript','textStyle','highlight') or exists(select 1 from jsonb_object_keys(m) key where key not in ('type','attrs')) then raise exception 'Invalid mark'; end if;
  if m->>'type' not in ('link','textStyle','highlight') and m ? 'attrs' then raise exception 'Invalid mark attrs'; end if;
  if m->>'type' in ('textStyle','highlight') then
   if jsonb_typeof(m->'attrs') is distinct from 'object' or exists(select 1 from jsonb_object_keys(m->'attrs') key where key<> 'color' and not(key='fontSize' and m->>'type'='textStyle')) then raise exception 'Invalid format attrs'; end if;
   if m->'attrs'->>'color' is not null and m->'attrs'->>'color' !~* '^#[0-9a-f]{6}$' then raise exception 'Invalid text color'; end if;
   if m->'attrs'->>'fontSize' is not null and m->'attrs'->>'fontSize' not in ('12px','14px','16px','18px','20px','24px') then raise exception 'Invalid font size'; end if;
  end if;
  if m->>'type'='link' and (jsonb_typeof(m->'attrs') is distinct from 'object' or jsonb_typeof(m->'attrs'->'href') is distinct from 'string' or length(m->'attrs'->>'href')>2000 or (m->'attrs' ? 'target' and coalesce(m->'attrs'->>'target','_blank')<>'_blank') or (m->'attrs' ? 'rel' and jsonb_typeof(m->'attrs'->'rel') is distinct from 'string') or (m->'attrs' ? 'class' and jsonb_typeof(m->'attrs'->'class') is distinct from 'null')) then raise exception 'Invalid link attrs'; end if;
  if m->>'type'='link' and (coalesce(m->'attrs'->>'href','') !~* '^(https://[^[:space:]]+|mailto:[^[:space:]]+)$' or exists(select 1 from jsonb_object_keys(m->'attrs') key where key not in ('href','target','rel','class'))) then raise exception 'Invalid link'; end if;
 end loop;
 child_types := case typ when 'doc' then array['paragraph','heading','bulletList','orderedList','blockquote','codeBlock','image','table','horizontalRule'] when 'paragraph' then array['text','hardBreak'] when 'heading' then array['text','hardBreak'] when 'codeBlock' then array['text'] when 'bulletList' then array['listItem'] when 'orderedList' then array['listItem'] when 'listItem' then array['paragraph','heading','bulletList','orderedList','blockquote','codeBlock','image','table'] when 'blockquote' then array['paragraph','heading','bulletList','orderedList','image'] when 'table' then array['tableRow'] when 'tableRow' then array['tableCell','tableHeader'] when 'tableCell' then array['paragraph','bulletList','orderedList','image'] when 'tableHeader' then array['paragraph','bulletList','orderedList','image'] else array[]::text[] end;
 for c in select value from jsonb_array_elements(coalesce(n->'content','[]')) loop
  if not (c->>'type')=any(child_types) then raise exception 'Invalid nesting'; end if;
  perform kb_private.validate_node(c,level+1);
 end loop;
end $$;
