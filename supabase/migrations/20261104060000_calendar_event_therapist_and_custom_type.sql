-- Adds "therapist" (behandler) and "other" as calendar event types, plus
-- custom_type for the text someone types in when they pick "other".
-- The app sets custom_type only for "other" events. That isn't a check
-- constraint because a new enum value can't be used in the transaction that
-- adds it.

alter type public.calendar_event_type add value if not exists 'therapist';
alter type public.calendar_event_type add value if not exists 'other';

alter table public.calendar_events
add column custom_type text
constraint calendar_events_custom_type_length
check (char_length(custom_type) <= 50);
