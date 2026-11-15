-- Horse owners (primary and additional) may add, replace and remove the photo
-- of their own horse. Paths are {stable_id}/{horse_id}/photo-....jpg; the
-- horse is matched on both parts, compared as text so a malformed path never
-- fails a uuid cast.
create or replace function public.auth_owns_horse_photo_path(p_name text)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.horses h
    where h.stable_id::text = (storage.foldername(p_name))[1]
      and h.id::text = (storage.foldername(p_name))[2]
      and public.auth_owns_horse(h.id)
  );
$$;

revoke execute on function public.auth_owns_horse_photo_path(text) from public, anon;
grant execute on function public.auth_owns_horse_photo_path(text) to authenticated;

create policy horse_photos_select_owner on storage.objects
for select to authenticated
using (bucket_id = 'horse-photos' and public.auth_owns_horse_photo_path(name));

create policy horse_photos_write_owner on storage.objects
for insert to authenticated
with check (bucket_id = 'horse-photos' and public.auth_owns_horse_photo_path(name));

create policy horse_photos_delete_owner on storage.objects
for delete to authenticated
using (bucket_id = 'horse-photos' and public.auth_owns_horse_photo_path(name));
