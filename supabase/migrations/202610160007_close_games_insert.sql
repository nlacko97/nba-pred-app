-- The baseline let anyone with the public anon key insert games, which then
-- show on every slate and count toward the daily confidence budget. Games
-- are only written by the edge functions, which use the service role.
drop policy if exists "Users can insert games." on public.games;
