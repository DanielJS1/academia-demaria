alter table public.academy_quiz_questions
 add column image_url text check (image_url is null or image_url ~ '^https://'),
 add column image_alt text check (image_url is null or char_length(trim(coalesce(image_alt,''))) > 0);
