-- Licenças do Cortix desktop no Supabase pessoal (projeto Fizpravoce), schema isolado "cortix".
-- Só quem tem linha em cortix.licenses com active = true (e não expirada) consegue logar no app.
-- Idempotente: pode rodar de novo.

create schema if not exists cortix;

create table if not exists cortix.licenses (
  user_id     uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  name        text,
  plan        text not null default 'viral',      -- lite | creator | viral
  active      boolean not null default true,
  expires_at  timestamptz,                         -- null = sem validade
  max_devices int not null default 2,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists cortix.devices (
  id           bigserial primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  device_id    text not null,
  hostname     text,
  app_version  text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  unique (user_id, device_id)
);

create table if not exists cortix.login_log (
  id         bigserial primary key,
  user_id    uuid,
  email      text,
  device_id  text,
  ok         boolean not null,
  reason     text,
  at         timestamptz not null default now()
);

alter table cortix.licenses  enable row level security;
alter table cortix.devices   enable row level security;
alter table cortix.login_log enable row level security;

drop policy if exists "licenca propria" on cortix.licenses;
create policy "licenca propria" on cortix.licenses
  for select to authenticated using (auth.uid() = user_id);

drop policy if exists "dispositivos proprios" on cortix.devices;
create policy "dispositivos proprios" on cortix.devices
  for select to authenticated using (auth.uid() = user_id);

-- Chamada pelo app logo após o login por senha. Decide se entra e registra o dispositivo.
create or replace function cortix.check_license(p_device_id text, p_hostname text default null, p_version text default null)
returns jsonb
language plpgsql
security definer
set search_path = cortix, public
as $$
declare
  uid uuid := auth.uid();
  lic cortix.licenses%rowtype;
  n_devices int;
  known boolean;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'nao_autenticado');
  end if;

  select * into lic from cortix.licenses where user_id = uid;
  if not found then
    insert into cortix.login_log(user_id, device_id, ok, reason) values (uid, p_device_id, false, 'sem_licenca');
    return jsonb_build_object('ok', false, 'reason', 'sem_licenca');
  end if;
  if not lic.active then
    insert into cortix.login_log(user_id, email, device_id, ok, reason) values (uid, lic.email, p_device_id, false, 'bloqueado');
    return jsonb_build_object('ok', false, 'reason', 'bloqueado');
  end if;
  if lic.expires_at is not null and lic.expires_at < now() then
    insert into cortix.login_log(user_id, email, device_id, ok, reason) values (uid, lic.email, p_device_id, false, 'expirado');
    return jsonb_build_object('ok', false, 'reason', 'expirado', 'expires_at', lic.expires_at);
  end if;

  select exists(select 1 from cortix.devices where user_id = uid and device_id = p_device_id) into known;
  select count(*) into n_devices from cortix.devices where user_id = uid;
  if not known and n_devices >= lic.max_devices then
    insert into cortix.login_log(user_id, email, device_id, ok, reason) values (uid, lic.email, p_device_id, false, 'limite_dispositivos');
    return jsonb_build_object('ok', false, 'reason', 'limite_dispositivos', 'max_devices', lic.max_devices);
  end if;

  insert into cortix.devices(user_id, device_id, hostname, app_version)
  values (uid, p_device_id, p_hostname, p_version)
  on conflict (user_id, device_id) do update
    set hostname = excluded.hostname, app_version = excluded.app_version, last_seen_at = now();

  insert into cortix.login_log(user_id, email, device_id, ok) values (uid, lic.email, p_device_id, true);

  return jsonb_build_object(
    'ok', true,
    'email', lic.email,
    'name', lic.name,
    'plan', lic.plan,
    'expires_at', lic.expires_at,
    'max_devices', lic.max_devices
  );
end;
$$;

revoke all on function cortix.check_license(text, text, text) from public;
grant execute on function cortix.check_license(text, text, text) to authenticated;
grant usage on schema cortix to authenticated, service_role;
grant select on cortix.licenses, cortix.devices to authenticated;
grant all on all tables in schema cortix to service_role;
grant all on all sequences in schema cortix to service_role;

-- Expõe o schema no PostgREST preservando os que já existem (public, gerencia21, ...).
do $$
declare
  atual text;
  novo text;
begin
  select coalesce(
    (select split_part(cfg, '=', 2) from pg_roles r, unnest(r.rolconfig) cfg
      where r.rolname = 'authenticator' and cfg like 'pgrst.db_schemas=%'),
    'public') into atual;
  if position('cortix' in atual) = 0 then
    novo := atual || ',cortix';
    execute format('alter role authenticator set pgrst.db_schemas = %L', novo);
  end if;
end $$;
notify pgrst, 'reload config';
