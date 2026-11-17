---
kind: skill
name: Call outcomes and statuses
summary: How calls are logged, what each outcome means, and how the call-list status follows from it.
based_on: Decided from the DFC call sheet's nine statuses
---
A caller records what happened on one dial (the outcome). The app works out where the row stands (the status). Nobody sets the status by hand.

Outcomes
- connected: spoke with the decision maker.
- meeting_booked: a meeting is on the calendar.
- email_requested: they asked for an email instead. Counts as a connect.
- voicemail: left a message.
- no_answer: rang out, no message left.
- gatekeeper: reached a front desk, operator or phone tree and did not get through.
- bad_number: not in service, wrong number, fax or a busy tone every time.
- wrong_person: the contact has left or is not the right person.
- not_interested: a clear no. Closes the row.
- do_not_contact: they asked not to be called. Stops all contact with the company.

Statuses that follow
- Not started: no calls yet.
- Attempting: voicemail, no answer or gatekeeper. Also a bad number when another number is left to try.
- Connected: connected or email requested.
- Meeting booked.
- Needs info: bad number with nothing else to dial, or wrong person. Research a new number or contact.
- Closed: not interested.
- Do not contact.

Every call is logged against the number that was dialed, so a bad number is a fact about that number. Log with `log_call` and pass `phone_number_id` when you know which line was used.

The call sheet's wording maps like this: Not Started = not started; Left Voicemail, Called - No Answer, Emailed = attempting; Connected, E-mail Requested = connected; Error = needs info (the sheet uses Error for numbers that do not work); Wrong Contact, New Information Needed = needs info; Do Not Contact = do not contact.
