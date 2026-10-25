-- Cập nhật 25/10/2026: khách trả lời "Có" ở câu an toàn vẫn đặt được lịch, ca được gắn cờ đỏ.
-- Chạy 1 lần trong SQL Editor.

alter table public.bookings add column if not exists urgent boolean not null default false;

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

