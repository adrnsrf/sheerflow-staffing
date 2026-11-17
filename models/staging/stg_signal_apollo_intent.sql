-- Apollo buying intent for one of our topics. Company level. A high reading counts in full,
-- medium 60%, low 30%.
select
  'intent:' || i.id         as signal_id,
  'company'                 as level,
  i.company_id,
  null::integer             as person_id,
  'apollo_intent'           as signal_type,
  'Apollo intent'           as source,
  i.observed_at             as occurred_at,
  case i.level when 'high' then 1.0 when 'medium' then 0.6 else 0.3 end::float8 as strength,
  initcap(i.level) || ' intent: ' || i.topic as title,
  null::text                as detail,
  null::text                as url
from apollo_intent i
where i.company_id is not null
