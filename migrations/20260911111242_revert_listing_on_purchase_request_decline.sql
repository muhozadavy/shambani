-- Shambani: auto-revert a listing to "Available" whenever an Accepted purchase_request
-- moves away from Accepted (Declined/cancelled), regardless of which side made the change.
--
-- Why: today this revert only happens because the farmer app's declinePurchaseRequest()
-- function explicitly updates the listing row after declining the request. If a buyer
-- cancels their own accepted deal (buyerCancelSentRequest() in buyer-app.html), that
-- best-effort listing update likely fails under RLS, since listings are farmer-owned,
-- leaving the listing stuck as "Reserved" with no accepted deal behind it.
--
-- This trigger runs as SECURITY DEFINER, so it applies the fix with elevated privilege
-- no matter which authenticated user (farmer or buyer) triggered the status change,
-- closing the gap without loosening RLS on the listings table itself.
--
-- Safe to run more than once: CREATE OR REPLACE / DROP ... IF EXISTS throughout.

create or replace function marketplace.fn_revert_listing_on_purchase_request_decline()
returns trigger
language plpgsql
security definer
set search_path = marketplace, public
as $$
begin
  if old.status = 'Accepted' and new.status is distinct from 'Accepted' then
    update marketplace.listings
    set status = 'Available'
    where id = new.listing_id
      and status = 'Reserved';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_revert_listing_on_purchase_request_decline on marketplace.purchase_requests;

create trigger trg_revert_listing_on_purchase_request_decline
after update on marketplace.purchase_requests
for each row
when (old.status is distinct from new.status)
execute function marketplace.fn_revert_listing_on_purchase_request_decline();
