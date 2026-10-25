-- Tâm Trí Online: cơ sở dữ liệu đặt lịch
-- Chạy một lần trong Supabase: SQL Editor → New query → dán toàn bộ file → Run.

create extension if not exists pgcrypto;

-- Nhân viên: mỗi tài khoản đăng nhập là quản lý (admin) hoặc bác sĩ (doctor)
create table if not exists public.staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'doctor')),
  created_at timestamptz not null default now()
);

-- Khung giờ bác sĩ mở bán
create table if not exists public.slots (
  id uuid primary key default gen_random_uuid(),
  start_at timestamptz not null,
  dur int not null check (dur between 10 and 180),
  kind text not null check (kind in ('dau', 'tai')),   -- dau: khám lần đầu, tai: tái khám
  price int not null check (price >= 0),
  status text not null default 'open' check (status in ('open', 'held', 'sold', 'closed')),
  hold_until timestamptz,
  created_at timestamptz not null default now(),
  unique (start_at)
);

-- Ca khách đặt (thông tin nhạy cảm: chỉ nhân viên đọc được)
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  slot_id uuid references public.slots(id) on delete set null,
  name text not null,
  yob int not null,
  phone text not null,
  reason text,
  screen int[] not null,
  price int not null,
  status text not null default 'held' check (status in ('held', 'paid', 'expired', 'crisis', 'cancelled')),
  note text,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
alter table public.bookings add column if not exists urgent boolean not null default false;
create index if not exists bookings_slot_idx on public.bookings(slot_id);

create or replace function public.my_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff where user_id = auth.uid()
$$;

alter table public.staff enable row level security;
alter table public.slots enable row level security;
alter table public.bookings enable row level security;

-- staff: mỗi người đọc được dòng của mình; quản lý đọc tất cả
drop policy if exists staff_read on public.staff;
create policy staff_read on public.staff for select to authenticated
  using (user_id = auth.uid() or public.my_role() = 'admin');

-- slots: ai cũng xem được giờ, giá, trạng thái (không có thông tin khách)
drop policy if exists slots_public_read on public.slots;
create policy slots_public_read on public.slots for select to anon, authenticated using (true);
drop policy if exists slots_staff_write on public.slots;
create policy slots_staff_write on public.slots for all to authenticated
  using (public.my_role() in ('admin', 'doctor'))
  with check (public.my_role() in ('admin', 'doctor'));

-- bookings: khách không đọc trực tiếp; nhân viên đọc; chỉ quản lý sửa
drop policy if exists bookings_staff_read on public.bookings;
create policy bookings_staff_read on public.bookings for select to authenticated
  using (public.my_role() in ('admin', 'doctor'));
drop policy if exists bookings_admin_write on public.bookings;
create policy bookings_admin_write on public.bookings for update to authenticated
  using (public.my_role() = 'admin') with check (public.my_role() = 'admin');

-- Quyền ở mức bảng (RLS ở trên lọc tiếp từng dòng)
revoke all on public.bookings from anon;
revoke all on public.staff from anon;
revoke insert, update, delete on public.slots from anon;
grant select on public.slots to anon;
grant select, insert, update, delete on public.slots to authenticated;
grant select, update on public.bookings to authenticated;
grant select on public.staff to authenticated;

-- Khách giữ chỗ: khóa dòng để hai người không giữ cùng một khung
create or replace function public.book_slot(
  p_slot uuid, p_name text, p_yob int, p_phone text, p_reason text, p_screen int[]
) returns json
language plpgsql security definer set search_path = public as $$
declare
  s public.slots;
  c text;
  crisis boolean := coalesce(p_screen[1], 0) = 1 or coalesce(p_screen[2], 0) = 1;
begin
  if length(trim(coalesce(p_name, ''))) < 2 or length(trim(coalesce(p_phone, ''))) < 8 then
    raise exception 'invalid_input';
  end if;
  if p_yob is null or p_yob < 1920 or p_yob > extract(year from now())::int - 18 then
    raise exception 'invalid_age';
  end if;
  if array_length(p_screen, 1) is distinct from 3 then
    raise exception 'invalid_screen';
  end if;

  select * into s from public.slots where id = p_slot for update;
  if not found then raise exception 'slot_not_found'; end if;

  loop
    c := 'TT' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    exit when not exists (select 1 from public.bookings where code = c);
  end loop;

  if s.start_at < now() + interval '1 hour' then raise exception 'slot_too_late'; end if;
  if not (s.status = 'open' or (s.status = 'held' and s.hold_until < now())) then
    raise exception 'slot_taken';
  end if;

  update public.bookings set status = 'expired'
    where slot_id = s.id and status = 'held';
  update public.slots set status = 'held', hold_until = now() + interval '30 minutes' where id = s.id;
  -- Khách trả lời "Có" ở câu an toàn vẫn được giữ lịch, ca được gắn cờ đỏ để gọi lại sớm
  insert into public.bookings (code, slot_id, name, yob, phone, reason, screen, price, status, urgent)
  values (c, s.id, trim(p_name), p_yob, trim(p_phone), left(p_reason, 300), p_screen, s.price, 'held', crisis);

  return json_build_object('crisis', crisis, 'code', c, 'price', s.price,
    'start_at', s.start_at, 'dur', s.dur, 'kind', s.kind, 'hold_until', now() + interval '30 minutes');
end $$;

-- Khách xem trạng thái ca của mình bằng mã khám (chỉ trả về trạng thái)
create or replace function public.booking_status(p_code text) returns text
language sql stable security definer set search_path = public as $$
  select b.status from public.bookings b where b.code = upper(trim(p_code))
$$;

-- Quản lý xác nhận đã nhận tiền
create or replace function public.confirm_paid(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'not_allowed'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found'; end if;
  if b.slot_id is not null and exists (
    select 1 from public.bookings o where o.slot_id = b.slot_id and o.status = 'paid' and o.id <> b.id
  ) then raise exception 'slot_already_paid'; end if;
  update public.bookings set status = 'expired'
    where slot_id = b.slot_id and status = 'held' and id <> b.id;
  update public.bookings set status = 'paid', paid_at = now() where id = b.id;
  update public.slots set status = 'sold', hold_until = null where id = b.slot_id;
end $$;

-- Quản lý hủy ca (mở lại khung)
create or replace function public.cancel_booking(p_booking uuid) returns void
language plpgsql security definer set search_path = public as $$
declare b public.bookings;
begin
  if public.my_role() is distinct from 'admin' then raise exception 'not_allowed'; end if;
  select * into b from public.bookings where id = p_booking for update;
  if not found then raise exception 'not_found'; end if;
  update public.bookings set status = 'cancelled' where id = b.id;
  update public.slots set status = 'open', hold_until = null
    where id = b.slot_id and status in ('held', 'sold');
end $$;

revoke all on function public.book_slot(uuid, text, int, text, text, int[]) from public;
grant execute on function public.book_slot(uuid, text, int, text, text, int[]) to anon, authenticated;
grant execute on function public.booking_status(text) to anon, authenticated;
revoke all on function public.confirm_paid(uuid) from public, anon;
grant execute on function public.confirm_paid(uuid) to authenticated;
revoke all on function public.cancel_booking(uuid) from public, anon;
grant execute on function public.cancel_booking(uuid) to authenticated;
