-- Lets staff flag a notice board post as a warning, a reminder, or a
-- general/casual post, so the board can visually call out anything urgent.

alter table public.announcements
  add column category text not null default 'info'
  check (category in ('warning', 'reminder', 'info'));
