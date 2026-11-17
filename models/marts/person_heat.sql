-- One row per person with at least one person-level signal: why this person, now.
with by_type as (
  select person_id, signal_type, least(sum(score), 1.5 * max(weight)) as points
  from signals_fact where person_id is not null and level = 'person' group by person_id, signal_type
)
select
  f.person_id,
  (select round(sum(points)::numeric, 1)::float8 from by_type b where b.person_id = f.person_id) as heat,
  count(*)::int as signal_count,
  max(f.occurred_at) as last_signal_at,
  min(f.age_days) as freshest_days,
  (array_agg(f.title order by f.score desc))[1:3] as top_reasons,
  (array_agg(f.signal_type order by f.score desc))[1] as top_type
from signals_fact f
where f.person_id is not null and f.level = 'person'
group by f.person_id
