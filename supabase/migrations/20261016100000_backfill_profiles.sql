-- Accounts created before the schema existed (in the dashboard, or before `db push`) have no profile row,
-- because handle_new_user() was not there to make one. Give each of them a profile now.
insert into public.profiles (id, full_name)
select u.id, coalesce(nullif(u.raw_user_meta_data ->> 'full_name', ''), split_part(u.email, '@', 1))
from auth.users u
on conflict (id) do nothing;
