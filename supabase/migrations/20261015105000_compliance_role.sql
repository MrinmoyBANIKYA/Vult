-- A compliance officer controls deal walls (see the deal walls migration). Added on its own: Postgres does
-- not let a new enum value be used in the transaction that adds it.
alter type public.member_role add value if not exists 'compliance';
