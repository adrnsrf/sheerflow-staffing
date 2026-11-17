---
name: Write LinkedIn connection notes and messages
schedule: On demand (queued by the Connect? and Draft message buttons)
summary: Write a short connection note for everyone ticked Connect?, and first messages for people who accepted.
based_on: New for the app (the connection queue in the platform plan)
---
Never contact anyone. This routine only writes drafts for Adrian to review and send by hand.

Connection notes
1. `search_people` with connection "queued".
2. For each person, `get_account` on their company for the signal that put them here (a hiring post, a new role, open data roles).
3. Write one note, 300 characters at most, in Adrian's voice: plain, specific to their post or role, no pitch, no "I hope this finds you well". Mention SheerFlow places data engineers and analytics people only if it fits naturally.
4. Save with `draft_note`.

First messages (jobs of kind draft_linkedin_message)
1. The job payload has the person id. Read the account and any past touches.
2. Write a message of 3 to 5 short sentences: thank them for connecting, one line on what you noticed, one clear ask (a 15 minute call), nothing else.
3. Save with `save_draft`, kind linkedin_message, with the person id.

Finish each job with `complete_job` and a one-line count.
