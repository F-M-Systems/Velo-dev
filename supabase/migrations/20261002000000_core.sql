-- Core tenancy: profiles, organizations, memberships, teams, invites, licenses.
-- Every table has RLS; tenants are isolated by org membership.

create type public.member_role as enum ('owner', 'admin', 'coach', 'athlete', 'guardian');
create type public.license_status as enum ('trialing', 'active', 'past_due', 'canceled');

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  locale text not null default 'en'
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  country text check (country ~ '^[A-Z]{2}$'),
  timezone text not null default 'UTC',
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  locale text not null default 'en',
  created_at timestamptz not null default now()
);

create table public.memberships (
  org_id uuid not null references public.organizations on delete cascade,
  user_id uuid not null references public.profiles on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);
create index on public.memberships (user_id);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  name text not null check (length(trim(name)) between 1 and 120),
  sport text not null default '',
  age_group text not null default '',
  created_at timestamptz not null default now(),
  unique (id, org_id)
);
create index on public.teams (org_id);

-- org_id is repeated so the FKs guarantee team and member belong to the same org.
create table public.team_members (
  team_id uuid not null,
  user_id uuid not null,
  org_id uuid not null,
  primary key (team_id, user_id),
  foreign key (team_id, org_id) references public.teams (id, org_id) on delete cascade,
  foreign key (org_id, user_id) references public.memberships (org_id, user_id) on delete cascade
);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations on delete cascade,
  email text not null check (email = lower(email) and email like '%_@_%'),
  role public.member_role not null check (role <> 'owner'),
  team_id uuid,
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid not null default auth.uid() references auth.users on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key (team_id, org_id) references public.teams (id, org_id) on delete cascade
);
create index on public.invites (org_id);

-- Written only by the Stripe webhook (service role). max_coaches counts all staff seats
-- (owner, admin, coach); guardians are free.
create table public.licenses (
  org_id uuid primary key references public.organizations on delete cascade,
  max_coaches int not null check (max_coaches >= 1),
  max_teams int not null check (max_teams >= 0),
  max_athletes int not null check (max_athletes >= 0),
  status public.license_status not null,
  current_period_end timestamptz not null,
  stripe_customer_id text unique,
  stripe_subscription_id text unique
);

-- ---------------------------------------------------------------- helpers

-- security definer: policies on memberships call this, so it must bypass RLS to avoid recursion.
create function public.is_member(_org uuid, _roles public.member_role[] default null)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = _org
      and m.user_id = (select auth.uid())
      and (_roles is null or m.role = any (_roles))
  );
$$;

create function public.shares_org(_user uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships a
    join public.memberships b using (org_id)
    where a.user_id = (select auth.uid()) and b.user_id = _user
  );
$$;

-- Trials end hard; paid licenses get 7 days of grace for late webhooks and payment retries.
create function public.license_active(_org uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.licenses l
    where l.org_id = _org
      and ((l.status = 'trialing' and l.current_period_end > now())
        or (l.status in ('active', 'past_due') and l.current_period_end + interval '7 days' > now()))
  );
$$;

-- ---------------------------------------------------------------- license limits

create function public.enforce_license()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  lic public.licenses;
  used int;
begin
  -- Lock the license row so concurrent inserts cannot both slip under the limit.
  select * into lic from public.licenses where org_id = new.org_id for update;
  if not found or not public.license_active(new.org_id) then
    raise exception 'license_inactive' using errcode = 'P0001';
  end if;

  if tg_table_name = 'teams' then
    select count(*) into used from public.teams where org_id = new.org_id;
    if used >= lic.max_teams then
      raise exception 'license_limit_teams' using errcode = 'P0001';
    end if;
  elsif new.role = 'athlete' then
    select count(*) into used from public.memberships
      where org_id = new.org_id and role = 'athlete' and user_id <> new.user_id;
    if used >= lic.max_athletes then
      raise exception 'license_limit_athletes' using errcode = 'P0001';
    end if;
  elsif new.role in ('owner', 'admin', 'coach') then
    select count(*) into used from public.memberships
      where org_id = new.org_id and role in ('owner', 'admin', 'coach') and user_id <> new.user_id;
    if used >= lic.max_coaches then
      raise exception 'license_limit_coaches' using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

create trigger enforce_license before insert on public.teams
  for each row execute function public.enforce_license();
create trigger enforce_license before insert or update of role on public.memberships
  for each row execute function public.enforce_license();

-- ---------------------------------------------------------------- RPCs

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creates the org, a 14-day trial license and the caller's owner membership.
create function public.create_organization(_name text, _timezone text default 'UTC', _locale text default 'en')
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  _org uuid;
begin
  if (select auth.uid()) is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  insert into public.organizations (name, timezone, locale)
    values (_name, _timezone, _locale) returning id into _org;
  insert into public.licenses (org_id, max_coaches, max_teams, max_athletes, status, current_period_end)
    values (_org, 3, 2, 40, 'trialing', now() + interval '14 days');
  insert into public.memberships (org_id, user_id, role)
    values (_org, (select auth.uid()), 'owner');
  return _org;
end;
$$;

-- The invite is bound to the email it was sent to, so a leaked link is useless to anyone else.
create function public.accept_invite(_token uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  inv public.invites;
begin
  select * into inv from public.invites
    where token = _token and accepted_at is null and expires_at > now()
    for update;
  if not found then
    raise exception 'invite_invalid' using errcode = 'P0001';
  end if;
  if inv.email <> lower(coalesce((select auth.jwt()) ->> 'email', '')) then
    raise exception 'invite_email_mismatch' using errcode = 'P0001';
  end if;

  insert into public.memberships (org_id, user_id, role)
    values (inv.org_id, (select auth.uid()), inv.role)
    on conflict do nothing;
  if inv.team_id is not null then
    insert into public.team_members (team_id, user_id, org_id)
      values (inv.team_id, (select auth.uid()), inv.org_id)
      on conflict do nothing;
  end if;
  update public.invites set accepted_at = now() where id = inv.id;
  return inv.org_id;
end;
$$;

revoke execute on function
  public.is_member, public.shares_org, public.license_active,
  public.create_organization, public.accept_invite,
  public.enforce_license, public.handle_new_user
  from public, anon, authenticated;
grant execute on function
  public.is_member, public.shares_org, public.license_active,
  public.create_organization, public.accept_invite
  to authenticated;

-- ---------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.invites enable row level security;
alter table public.licenses enable row level security;

-- Explicit, minimal grants: anon gets nothing; column grants stop key/tenant columns being rewritten.
revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles, public.organizations, public.memberships, public.teams,
  public.team_members, public.invites, public.licenses to authenticated;
grant update (full_name, locale) on public.profiles to authenticated;
grant update (name, country, timezone, currency, locale) on public.organizations to authenticated;
grant update (role), delete on public.memberships to authenticated;
grant insert (org_id, name, sport, age_group), update (name, sport, age_group), delete on public.teams to authenticated;
grant insert, delete on public.team_members to authenticated;
grant insert (org_id, email, role, team_id), delete on public.invites to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_org(id));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy organizations_select on public.organizations for select to authenticated
  using (public.is_member(id));
create policy organizations_update on public.organizations for update to authenticated
  using (public.is_member(id, '{owner,admin}')) with check (public.is_member(id, '{owner,admin}'));

create policy memberships_select on public.memberships for select to authenticated
  using (public.is_member(org_id));
-- Owners are never editable here; ownership transfer will be its own RPC.
create policy memberships_update on public.memberships for update to authenticated
  using (role <> 'owner' and public.is_member(org_id, '{owner,admin}'))
  with check (role <> 'owner' and public.is_member(org_id, '{owner,admin}'));
create policy memberships_delete on public.memberships for delete to authenticated
  using (role <> 'owner' and (user_id = (select auth.uid()) or public.is_member(org_id, '{owner,admin}')));

create policy teams_select on public.teams for select to authenticated
  using (public.is_member(org_id));
create policy teams_insert on public.teams for insert to authenticated
  with check (public.is_member(org_id, '{owner,admin}'));
create policy teams_update on public.teams for update to authenticated
  using (public.is_member(org_id, '{owner,admin}') and public.license_active(org_id))
  with check (public.is_member(org_id, '{owner,admin}'));
create policy teams_delete on public.teams for delete to authenticated
  using (public.is_member(org_id, '{owner,admin}'));

create policy team_members_select on public.team_members for select to authenticated
  using (public.is_member(org_id));
create policy team_members_insert on public.team_members for insert to authenticated
  with check (public.is_member(org_id, '{owner,admin,coach}') and public.license_active(org_id));
create policy team_members_delete on public.team_members for delete to authenticated
  using (public.is_member(org_id, '{owner,admin,coach}'));

create policy invites_select on public.invites for select to authenticated
  using (public.is_member(org_id, '{owner,admin}'));
create policy invites_insert on public.invites for insert to authenticated
  with check (public.is_member(org_id, '{owner,admin}') and public.license_active(org_id));
create policy invites_delete on public.invites for delete to authenticated
  using (public.is_member(org_id, '{owner,admin}'));

create policy licenses_select on public.licenses for select to authenticated
  using (public.is_member(org_id, '{owner,admin}'));
