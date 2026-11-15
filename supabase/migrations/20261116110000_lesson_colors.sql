-- A colour for each course, and for single lessons, so they're easy to tell apart
-- in the calendar and the lists. Null means the standard colour (green for
-- lessons, brown for courses), so existing ones look as before. A course's
-- sessions use the course's colour.
alter table public.courses
  add column color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');

alter table public.lesson_sessions
  add column color text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$');
