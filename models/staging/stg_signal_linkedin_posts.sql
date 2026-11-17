-- LinkedIn posts found by the daily routine: someone says they are hiring data people, or has
-- just started as a data leader. Person level when we know the poster.
select
  'post:' || s.id                                                        as signal_id,
  case when s.person_id is not null then 'person' else 'company' end     as level,
  s.company_id,
  s.person_id,
  case when s.type = 'new_leader' then 'new_leader_post' else 'hiring_post' end as signal_type,
  s.source,
  s.signal_date                                                          as occurred_at,
  1.0::float8                                                            as strength,
  s.title,
  s.summary                                                              as detail,
  s.source_url                                                           as url
from signals s
where s.type in ('hiring_post', 'new_leader') and s.status <> 'dismissed'
