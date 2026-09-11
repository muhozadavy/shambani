-- Storage bucket for farmer/buyer photos: crop listing photos, farmer profile photo,
-- buying request reference photo. Public bucket (photos are meant to be seen by the
-- other side of the marketplace), but writes are locked to each user's own folder.
insert into storage.buckets (id, name, public)
values ('shambani-photos', 'shambani-photos', true)
on conflict (id) do update set public = true;

-- Path convention: {auth.uid()}/profile.jpg, {auth.uid()}/listings/{ts}-{rand}.jpg,
-- {auth.uid()}/requests/{ts}-{rand}.jpg -- so the first path segment is always the
-- owning user's id and doubles as the RLS check.
drop policy if exists "shambani photos own folder insert" on storage.objects;
create policy "shambani photos own folder insert" on storage.objects
for insert to authenticated
with check (
  bucket_id = 'shambani-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "shambani photos own folder update" on storage.objects;
create policy "shambani photos own folder update" on storage.objects
for update to authenticated
using (
  bucket_id = 'shambani-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
)
with check (
  bucket_id = 'shambani-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "shambani photos own folder delete" on storage.objects;
create policy "shambani photos own folder delete" on storage.objects
for delete to authenticated
using (
  bucket_id = 'shambani-photos'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "shambani photos public read" on storage.objects;
create policy "shambani photos public read" on storage.objects
for select to public
using (bucket_id = 'shambani-photos');

-- Real photo references alongside the existing photos_count counter (kept in sync
-- from the app for backward compatibility, not used for display anymore).
alter table marketplace.listings add column if not exists photo_urls text[] not null default '{}';
alter table marketplace.farmers add column if not exists photo_url text;
alter table marketplace.buying_requests add column if not exists photo_url text;
