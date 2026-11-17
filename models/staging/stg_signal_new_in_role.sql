-- A decision maker under six months in the role: new leaders build teams and pick new vendors.
-- Person level.
select
  'tenure:' || p.id         as signal_id,
  'person'                  as level,
  p.company_id,
  p.id                      as person_id,
  'new_in_role'             as signal_type,
  'Contact research'        as source,
  p.created_at              as occurred_at,
  1.0::float8               as strength,
  p.name || ' is under 6 months in the role' as title,
  p.title                   as detail,
  p.linkedin_url            as url
from people p
where p.type = 'decision_maker' and p.time_in_role ~ '^<\s*6'
