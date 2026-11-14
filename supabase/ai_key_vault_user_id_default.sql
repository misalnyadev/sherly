-- SherlyStudio AI Key Vault v1.1 (optional hardening, safe to re-run)
-- Default user_id to the caller's uid so inserts can never violate the owner RLS policy.
alter table public.ai_provider_keys alter column user_id set default auth.uid();
