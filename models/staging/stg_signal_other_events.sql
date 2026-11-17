-- One-off events added by hand or by a Claude run: funding, a job posting someone noticed,
-- anything else. Company level. Job alerts promoted to the inbox are left out here because
-- they already count through stg_signal_job_postings.
select
  'event:' || s.id          as signal_id,
  'company'                 as level,
  s.company_id,
  s.person_id,
  case s.type when 'funding' then 'funding' when 'job_posting' then 'job_posting' when 'job_alert' then 'job_posting' else 'other' end as signal_type,
  s.source,
  s.signal_date             as occurred_at,
  1.0::float8               as strength,
  s.title,
  s.summary                 as detail,
  s.source_url              as url
from signals s
where s.type not in ('hiring_post', 'new_leader') and s.status <> 'dismissed'
  and coalesce(s.external_id, '') not like 'li-job-%'
