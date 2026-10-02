-- Tenant isolation, license limits and invite binding. Run with: supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'alice@a.test'),
  ('00000000-0000-0000-0000-00000000000b', 'bob@b.test'),
  ('00000000-0000-0000-0000-00000000000c', 'carol@a.test');

create function public._login(_id text, _email text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', _id, 'email', _email)::text, true),
         set_config('role', 'authenticated', true);
$$;
grant execute on function public._login to authenticated;

-- Alice and Bob each create a club.
select public._login('00000000-0000-0000-0000-00000000000a', 'alice@a.test');
select set_config('t.org_a', public.create_organization('Club A')::text, true);
select public._login('00000000-0000-0000-0000-00000000000b', 'bob@b.test');
select set_config('t.org_b', public.create_organization('Club B')::text, true);
insert into public.teams (org_id, name) values (current_setting('t.org_b')::uuid, 'B1');

-- Isolation
select public._login('00000000-0000-0000-0000-00000000000a', 'alice@a.test');
select is((select count(*) from public.organizations), 1::bigint, 'alice sees only her org');
select is((select count(*) from public.teams), 0::bigint, 'alice cannot see teams of org B');
select is((select count(*) from public.licenses), 1::bigint, 'alice sees only her license');
select throws_ok(
  $$ insert into public.teams (org_id, name) values (current_setting('t.org_b')::uuid, 'hack') $$,
  '42501', null, 'alice cannot create a team in org B');
select throws_ok(
  $$ update public.licenses set max_teams = 999 $$,
  '42501', null, 'members cannot edit their license');

-- Team limit (trial allows 2)
insert into public.teams (org_id, name) values
  (current_setting('t.org_a')::uuid, 'A1'), (current_setting('t.org_a')::uuid, 'A2');
select throws_ok(
  $$ insert into public.teams (org_id, name) values (current_setting('t.org_a')::uuid, 'A3') $$,
  'P0001', 'license_limit_teams', 'team limit is enforced');

-- Invites are bound to the invited email
insert into public.invites (org_id, email, role)
  values (current_setting('t.org_a')::uuid, 'carol@a.test', 'athlete');
select set_config('t.token', (select token::text from public.invites), true);

select public._login('00000000-0000-0000-0000-00000000000b', 'bob@b.test');
select throws_ok(
  $$ select public.accept_invite(current_setting('t.token')::uuid) $$,
  'P0001', 'invite_email_mismatch', 'bob cannot use an invite sent to carol');

select public._login('00000000-0000-0000-0000-00000000000c', 'carol@a.test');
select lives_ok(
  $$ select public.accept_invite(current_setting('t.token')::uuid) $$, 'carol accepts her invite');
select is((select role::text from public.memberships where user_id = auth.uid()), 'athlete', 'carol is an athlete');
select throws_ok(
  $$ select public.accept_invite(current_setting('t.token')::uuid) $$,
  'P0001', 'invite_invalid', 'an invite cannot be reused');
select throws_ok(
  $$ insert into public.invites (org_id, email, role) values (current_setting('t.org_a')::uuid, 'x@a.test', 'coach') $$,
  '42501', null, 'athletes cannot invite');

-- Expired license blocks writes
reset role;
update public.licenses set current_period_end = now() - interval '1 day'
  where org_id = current_setting('t.org_a')::uuid;
delete from public.teams where name = 'A2';
select public._login('00000000-0000-0000-0000-00000000000a', 'alice@a.test');
select throws_ok(
  $$ insert into public.teams (org_id, name) values (current_setting('t.org_a')::uuid, 'A2') $$,
  'P0001', 'license_inactive', 'expired trial blocks new teams');

select * from finish();
rollback;
