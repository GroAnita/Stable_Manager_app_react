-- Adds a 4th subscription tier between the old "large" and what used to
-- be its top end: small/medium/large/xlarge now split the horse-count
-- ranges more finely (10 / 20 / 30 / 31+).
alter type public.stable_plan add value 'xlarge';
