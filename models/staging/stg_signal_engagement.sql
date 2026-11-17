-- What our own outreach tells us: they picked up, asked for an email, accepted on LinkedIn or
-- replied. The strongest signals there are, because the person has already responded to us.
select
  'call:' || c.id           as signal_id,
  case when c.person_id is not null then 'person' else 'company' end as level,
  c.company_id,
  c.person_id,
  case c.outcome when 'email_requested' then 'email_requested' else 'spoke_with_us' end as signal_type,
  'Call log'                as source,
  c.called_at               as occurred_at,
  1.0::float8               as strength,
  case c.outcome when 'email_requested' then 'Asked for an email' when 'meeting_booked' then 'Booked a meeting' else 'Spoke with us' end as title,
  c.notes                   as detail,
  null::text                as url
from call_log c
where c.outcome in ('connected', 'meeting_booked', 'email_requested')
union all
select 'accepted:' || p.id, 'person', p.company_id, p.id, 'linkedin_accepted', 'LinkedIn', p.connected_at, 1.0::float8,
  p.name || ' accepted your connection request', null::text, p.linkedin_url
from people p
where p.connected_at is not null
union all
select 'reply:' || a.id, case when a.person_id is not null then 'person' else 'company' end, a.company_id, a.person_id, 'replied', 'Email', a.occurred_at, 1.0::float8,
  'Replied to an email', a.notes, null::text
from activities a
where a.type = 'email' and a.outcome = 'replied'
