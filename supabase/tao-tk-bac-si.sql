-- Tạo tài khoản bác sĩ (đăng nhập ở /quan-ly/) và cấp quyền "doctor".
-- Sửa email và mật khẩu tạm ở 2 dòng v_email, v_pass, rồi dán vào SQL Editor → Run.
-- Chạy lại cũng không sao: nếu email đã có thì chỉ đặt lại mật khẩu.
-- Bác sĩ đăng nhập xong vào mục "Tài khoản" để đổi sang mật khẩu riêng.
do $$
declare
  v_email text := 'EMAIL_BAC_SI@gmail.com';
  v_pass  text := 'MAT_KHAU_TAM';
  v_id uuid;
begin
  select id into v_id from auth.users where email = v_email;
  if v_id is null then
    v_id := gen_random_uuid();
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new)
    values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
      extensions.crypt(v_pass, extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), v_id, v_id::text,
      json_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  else
    update auth.users set encrypted_password = extensions.crypt(v_pass, extensions.gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now() where id = v_id;
  end if;
  insert into public.staff (user_id, email, role) values (v_id, v_email, 'doctor')
  on conflict (user_id) do update set role = 'doctor';
end $$;

select email, role from public.staff;
