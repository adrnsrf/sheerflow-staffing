-- Open data roles seen as job postings: LinkedIn job alert emails and Apollo job postings.
-- Company level. Only postings matched to an account count.
select
  'job:' || j.id            as signal_id,
  'company'                 as level,
  j.company_id,
  null::integer             as person_id,
  'job_posting'             as signal_type,
  j.source,
  j.received_at             as occurred_at,
  1.0::float8               as strength,
  j.company_name || ' posted ' || j.title as title,
  nullif(concat_ws(' · ', j.location, j.workplace, j.salary), '') as detail,
  j.url
from job_postings j
where j.company_id is not null and j.status <> 'dismissed'
