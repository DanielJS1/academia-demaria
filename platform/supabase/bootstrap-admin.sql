-- Depois de criar daniel@sacdemaria.com.br em Authentication > Users.
-- Não contém senha. Execute no SQL Editor com sua conta de proprietário.
do $$
declare admin_id uuid;
begin
 select id into admin_id from auth.users where lower(email)='daniel@sacdemaria.com.br';
 if admin_id is null then raise exception 'Crie primeiro o usuário daniel@sacdemaria.com.br em Authentication > Users'; end if;
 insert into public.academy_profiles(id,name,email,department,role,status)
 values(admin_id,'Daniel','daniel@sacdemaria.com.br','Comercial','admin','active')
 on conflict(id) do update set role='admin',status='active';
end $$;
