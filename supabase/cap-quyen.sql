-- Cấp quyền cho tài khoản đã tạo ở Authentication → Users.
-- Sửa 2 email bên dưới cho đúng rồi Run.
insert into public.staff (user_id, email, role)
select id, email, 'admin' from auth.users where email = 'EMAIL_CUA_ANH@gmail.com'
on conflict (user_id) do update set role = excluded.role;

insert into public.staff (user_id, email, role)
select id, email, 'doctor' from auth.users where email = 'EMAIL_BAC_SI@gmail.com'
on conflict (user_id) do update set role = excluded.role;

select email, role from public.staff;
