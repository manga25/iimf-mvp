-- =====================================================================
-- IIMF MVP — notification functions (SPEC.md §3.8, AC-7.1 – AC-7.4)
-- Paste into the Supabase SQL editor and run once, after 0006_payment_rpc.sql.
--
-- Notifications are created by earlier flows (cancellation, modality change,
-- absence, overdue). These functions are the teacher's actions on the log:
--   * save_notification_message: edit the text while it is pending.
--   * mark_notification_sent:    store the final text and mark it sent
--                                (Copy message / Open WhatsApp), atomically.
--   * dismiss_notification:      pending → dismissed.
--
-- Rules:
--   * Only `pending` notifications can change; `sent` ones never change and
--     `dismissed` ones stay dismissed.
--   * The message is trimmed, must not be empty and is at most 2000 chars.
--
-- Error codes: IM404 unknown notification · IM409 no longer pending ·
-- 22023 invalid input.
--
-- Each function returns the updated notification as JSON.
-- Safe to run more than once (create or replace / grant are idempotent).
-- =====================================================================
begin;

alter table public.notifications drop constraint if exists notifications_message_length_chk;
alter table public.notifications
  add constraint notifications_message_length_chk check (char_length(message) <= 2000) not valid;

-- ---------------------------------------------------------------------
-- Locks a pending notification, or raises IM404 / IM409.
-- ---------------------------------------------------------------------
create or replace function public.lock_pending_notification(p_id uuid)
returns public.notifications
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.notifications;
begin
  select * into v from public.notifications where id = p_id for update;
  if not found then
    raise exception 'Notification not found.' using errcode = 'IM404';
  end if;
  if v.status <> 'pending' then
    raise exception 'This notification is no longer pending.' using errcode = 'IM409';
  end if;
  return v;
end;
$$;

-- Trims and checks a message, or raises 22023.
create or replace function public.clean_notification_message(p_message text)
returns text
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_message, ''));
begin
  if char_length(v) = 0 then
    raise exception 'The message cannot be empty.' using errcode = '22023';
  end if;
  if char_length(v) > 2000 then
    raise exception 'The message must be at most 2000 characters.' using errcode = '22023';
  end if;
  return v;
end;
$$;

create or replace function public.notification_json(n public.notifications)
returns jsonb
language sql
immutable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'id', n.id, 'student_id', n.student_id, 'type', n.type, 'recipient', n.recipient,
    'phone', n.phone, 'message', n.message, 'status', n.status,
    'session_id', n.session_id, 'payment_id', n.payment_id,
    'sent_at', n.sent_at, 'created_at', n.created_at
  );
$$;

-- ---------------------------------------------------------------------
-- Teacher actions
-- ---------------------------------------------------------------------
create or replace function public.save_notification_message(p_id uuid, p_message text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v       public.notifications := public.lock_pending_notification(p_id);
  v_text  text := public.clean_notification_message(p_message);
begin
  update public.notifications set message = v_text where id = v.id returning * into v;
  return public.notification_json(v);
end;
$$;

create or replace function public.mark_notification_sent(p_id uuid, p_message text)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v       public.notifications := public.lock_pending_notification(p_id);
  v_text  text := public.clean_notification_message(p_message);
begin
  update public.notifications
    set message = v_text, status = 'sent', sent_at = now()
    where id = v.id
    returning * into v;
  return public.notification_json(v);
end;
$$;

create or replace function public.dismiss_notification(p_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.notifications := public.lock_pending_notification(p_id);
begin
  update public.notifications set status = 'dismissed' where id = v.id returning * into v;
  return public.notification_json(v);
end;
$$;

-- ---------------------------------------------------------------------
-- Privileges: only the authenticated teacher (RLS still applies: security invoker).
-- ---------------------------------------------------------------------
revoke all on function public.lock_pending_notification(uuid) from public, anon;
revoke all on function public.clean_notification_message(text) from public, anon;
revoke all on function public.notification_json(public.notifications) from public, anon;
revoke all on function public.save_notification_message(uuid, text) from public, anon;
revoke all on function public.mark_notification_sent(uuid, text) from public, anon;
revoke all on function public.dismiss_notification(uuid) from public, anon;
grant execute on function public.lock_pending_notification(uuid) to authenticated;
grant execute on function public.clean_notification_message(text) to authenticated;
grant execute on function public.notification_json(public.notifications) to authenticated;
grant execute on function public.save_notification_message(uuid, text) to authenticated;
grant execute on function public.mark_notification_sent(uuid, text) to authenticated;
grant execute on function public.dismiss_notification(uuid) to authenticated;

commit;
