-- Migration 202609210003_profile_avatar.sql
-- Adiciona a coluna avatar na tabela de perfis (public.academy_profiles)
-- Armazena o avatar em formato WebP/JPEG leve compactado em Base64 ou URL de imagem,
-- permitindo persistência e exibição entre múltiplos navegadores e usuários.

alter table public.academy_profiles
  add column if not exists avatar text;

comment on column public.academy_profiles.avatar is 'Foto de perfil do usuário (Base64 WebP/JPEG compactado ou URL de imagem)';
