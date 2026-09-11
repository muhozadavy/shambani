-- Consolidate duplicate permissive RLS policies flagged by the performance advisor.
-- For each pair below, an "admin full ..." policy and a per-user policy were both
-- active for the same table+role+action, forcing Postgres to evaluate both on every
-- matching query. Access is unchanged: each merged policy still allows the same rows
-- the two separate policies allowed (own-row access OR marketplace.is_admin()).
-- Where the existing per-user policy already allowed everyone (qual = true, i.e. the
-- public "select all" policies on buying_requests/listings), the admin policy was
-- pure duplication and is simply dropped rather than merged.

-- buyers: SELECT
drop policy if exists "admin full select" on marketplace.buyers;
drop policy if exists "buyers select own" on marketplace.buyers;
create policy "buyers select own or admin" on marketplace.buyers
for select to authenticated
using ((select auth.uid()) = id or marketplace.is_admin());

-- farmers: SELECT
drop policy if exists "admin full select" on marketplace.farmers;
drop policy if exists "farmers select own" on marketplace.farmers;
create policy "farmers select own or admin" on marketplace.farmers
for select to authenticated
using ((select auth.uid()) = id or marketplace.is_admin());

-- buying_requests: DELETE
drop policy if exists "admin full delete" on marketplace.buying_requests;
drop policy if exists "buying_requests delete own" on marketplace.buying_requests;
create policy "buying_requests delete own or admin" on marketplace.buying_requests
for delete to authenticated
using ((select auth.uid()) = buyer_id or marketplace.is_admin());

-- buying_requests: SELECT (already public via "buying_requests select all"; admin policy was redundant)
drop policy if exists "admin full select" on marketplace.buying_requests;

-- listings: DELETE
drop policy if exists "admin full delete" on marketplace.listings;
drop policy if exists "listings delete own" on marketplace.listings;
create policy "listings delete own or admin" on marketplace.listings
for delete to authenticated
using ((select auth.uid()) = farmer_id or marketplace.is_admin());

-- listings: SELECT (already public via "listings select all"; admin policy was redundant)
drop policy if exists "admin full select" on marketplace.listings;

-- offers: SELECT
drop policy if exists "admin full select" on marketplace.offers;
drop policy if exists "offers select own or on my request" on marketplace.offers;
create policy "offers select own or admin" on marketplace.offers
for select to authenticated
using (
  (select auth.uid()) = farmer_id
  or (select auth.uid()) = (
    select br.buyer_id from marketplace.buying_requests br
    where br.id = offers.buying_request_id
  )
  or marketplace.is_admin()
);

-- purchase_requests: SELECT
drop policy if exists "admin full select" on marketplace.purchase_requests;
drop policy if exists "purchase_requests select own or on my listing" on marketplace.purchase_requests;
create policy "purchase_requests select own or admin" on marketplace.purchase_requests
for select to authenticated
using (
  (select auth.uid()) = buyer_id
  or (select auth.uid()) = (
    select l.farmer_id from marketplace.listings l
    where l.id = purchase_requests.listing_id
  )
  or marketplace.is_admin()
);
