-- What our own research says about a company: how many data roles were open when we looked.
-- One role counts half, two in full, three or more one and a half times.
select
  'roles:' || c.id          as signal_id,
  'company'                 as level,
  c.id                      as company_id,
  null::integer             as person_id,
  'open_roles'              as signal_type,
  'Company research'        as source,
  c.created_at              as occurred_at,
  (least(c.open_data_roles, 3) / 2.0)::float8 as strength,
  c.open_data_roles || ' open data role' || case when c.open_data_roles > 1 then 's' else '' end as title,
  null::text                as detail,
  c.website                 as url
from companies c
where c.open_data_roles > 0
