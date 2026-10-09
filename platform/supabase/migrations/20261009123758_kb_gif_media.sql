-- Keep the private bucket and the existing 5 MiB limit; permit GIF originals.
alter table public.kb_media drop constraint kb_media_mime_check;
alter table public.kb_media add constraint kb_media_mime_check
 check (mime in ('image/png','image/jpeg','image/webp','image/gif'));
update storage.buckets set allowed_mime_types=array['image/png','image/jpeg','image/webp','image/gif']
 where id='academy-kb';
