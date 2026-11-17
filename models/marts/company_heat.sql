-- One row per company: how strong the case is for reaching out now.
--   heat     = its signals' scores added up. Each type is capped at 1.5x its weight, so ten
--              job postings do not drown out everything else. People's signals count too.
--   fit      = how well the company matches who SheerFlow sells to (thin recruiting team,
--              right size, has a data team, ICP tier when scored).
--   priority = heat + fit. Fit alone is never a reason to act; it breaks ties between hot companies.
with by_type as (
  select company_id, signal_type, least(sum(score), 1.5 * max(weight)) as points, max(occurred_at) as last_at
  from signals_fact where company_id is not null group by company_id, signal_type
),
heat as (
  select company_id, round(sum(points)::numeric, 1)::float8 as heat, max(last_at) as last_signal_at from by_type group by company_id
),
reasons as (
  select company_id, count(*)::int as signal_count, (array_agg(title order by score desc))[1:3] as top_reasons
  from signals_fact where company_id is not null group by company_id
)
select
  c.id as company_id,
  coalesce(h.heat, 0) as heat,
  ( case when c.recruiting_team_size <= 2 and coalesce(c.technical_recruiters, 0) = 0 then 15 else 0 end
  + case when c.employees between 51 and 500 then 10 else 0 end
  + case when c.data_team_size >= 1 then 5 else 0 end
  + case c.icp_tier when 'A' then 20 when 'B' then 10 else 0 end )::float8 as fit,
  coalesce(h.heat, 0)
  + ( case when c.recruiting_team_size <= 2 and coalesce(c.technical_recruiters, 0) = 0 then 15 else 0 end
    + case when c.employees between 51 and 500 then 10 else 0 end
    + case when c.data_team_size >= 1 then 5 else 0 end
    + case c.icp_tier when 'A' then 20 when 'B' then 10 else 0 end ) as priority,
  coalesce(r.signal_count, 0) as signal_count,
  h.last_signal_at,
  coalesce(r.top_reasons, '{}') as top_reasons
from companies c
left join heat h on h.company_id = c.id
left join reasons r on r.company_id = c.id
