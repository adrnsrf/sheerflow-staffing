-- Every touch on a person or company, from every place the app records one, in one shape:
-- calls from the call log, LinkedIn / email / text / meetings from activities, and work Claude
-- finished for that person (a drafted note or message is progress too, though not a contact).
select
  'call:' || c.id            as touch_id,
  c.person_id,
  c.company_id,
  null::integer              as search_id,
  'call'                     as channel,
  c.outcome,
  c.notes,
  c.called_at                as at,
  true                       as contacted,
  c.outcome in ('connected', 'meeting_booked', 'email_requested') as responded,
  c.source = 'app'           as logged_here
from call_log c
union all
select
  'act:' || a.id, a.person_id, a.company_id, a.search_id, a.type, coalesce(a.outcome, ''), a.notes, a.occurred_at,
  a.type <> 'note' and coalesce(a.outcome, '') not in ('replied', 'connected'),
  coalesce(a.outcome, '') in ('replied', 'connected', 'held'),
  coalesce(a.notes, '') not like '%call sheet%'
from activities a
union all
select
  'job:' || j.id, nullif(j.payload ->> 'personId', '')::integer, nullif(j.payload ->> 'companyId', '')::integer, nullif(j.payload ->> 'searchId', '')::integer,
  'claude', j.kind, j.result, coalesce(j.completed_at, j.created_at), false, false, true
from jobs j
where j.status = 'done' and (j.payload ->> 'personId' is not null or j.payload ->> 'companyId' is not null)
