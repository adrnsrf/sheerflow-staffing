-- One row per signal event, from every source, in one shape. Each row is scored:
--   score = weight of its type x strength x decay, where decay halves every half-life.
-- So a hiring post is worth its full weight the day it is posted and half that two weeks later.
with unioned as (
  select * from stg_signal_linkedin_posts
  union all select * from stg_signal_job_postings
  union all select * from stg_signal_apollo_intent
  union all select * from stg_signal_company_research
  union all select * from stg_signal_new_in_role
  union all select * from stg_signal_other_events
  union all select * from stg_signal_engagement
)
select
  u.signal_id, u.level, u.company_id, u.person_id, u.signal_type, t.label as type_label, u.source,
  u.occurred_at, u.strength, u.title, u.detail, u.url,
  t.weight, t.half_life_days,
  greatest(0, extract(epoch from (now() - u.occurred_at)) / 86400.0)::float8 as age_days,
  round((t.weight * u.strength * power(0.5::float8, greatest(0, extract(epoch from (now() - u.occurred_at)) / 86400.0) / t.half_life_days))::numeric, 1)::float8 as score
from unioned u
join signal_types t on t.type = u.signal_type
where u.company_id is not null or u.person_id is not null
