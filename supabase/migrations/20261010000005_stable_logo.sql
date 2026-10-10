-- A small logo shown next to the stable name in the header, for everyone
-- in the stable (staff and boarders alike). Public bucket since it's just
-- a logo image, not sensitive data — mirrors the existing "avatars" bucket
-- pattern but scoped by stable_id instead of user id.

alter table public.stables add column logo_url text;

insert into storage.buckets (id, name, public)
values ('stable-logos', 'stable-logos', true);

create policy "stable_logos_public_read"
on storage.objects for select
using (bucket_id = 'stable-logos');

create policy "stable_logos_write_owner"
on storage.objects for insert
with check (
  bucket_id = 'stable-logos'
  and (storage.foldername(name))[1] = auth_stable_id()::text
  and auth_role() = 'stable_owner'::user_role
);

create policy "stable_logos_update_owner"
on storage.objects for update
using (
  bucket_id = 'stable-logos'
  and (storage.foldername(name))[1] = auth_stable_id()::text
  and auth_role() = 'stable_owner'::user_role
);

create policy "stable_logos_delete_owner"
on storage.objects for delete
using (
  bucket_id = 'stable-logos'
  and (storage.foldername(name))[1] = auth_stable_id()::text
  and auth_role() = 'stable_owner'::user_role
);
