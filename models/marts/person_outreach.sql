-- One row per person who has been worked: how many times we reached out, when, on which
-- channels, the last thing that happened, and whether they have responded.
select
  t.person_id,
  count(*) filter (where t.contacted)::int                              as contacts,
  count(*)::int                                                         as touches,
  min(t.at) filter (where t.contacted)                                  as first_contact_at,
  max(t.at) filter (where t.contacted)                                  as last_contact_at,
  max(t.at)                                                             as last_touch_at,
  (array_agg(t.channel order by t.at desc) filter (where t.contacted))[1] as last_channel,
  (array_agg(t.outcome order by t.at desc) filter (where t.contacted))[1] as last_outcome,
  bool_or(t.responded)                                                  as responded,
  max(t.at) filter (where t.responded)                                  as responded_at,
  array_agg(distinct t.channel) filter (where t.contacted)              as channels
from outreach_touches t
where t.person_id is not null
group by t.person_id
