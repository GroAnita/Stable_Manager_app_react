-- Riding schools often have horses the school itself uses for lessons,
-- distinct from boarders' own horses. Flagging a horse this way doesn't
-- change anything about how it's boarded/fed/billed — it's read by the
-- lesson_booking module's "School horses" screen only. Defaults to false
-- so every existing horse stays exactly as it was.
alter table public.horses
  add column is_school_horse boolean not null default false;
