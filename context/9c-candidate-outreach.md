---
kind: skill
name: Reaching out to candidates
summary: How candidate outreach works in the app, what a good first message looks like, and the consent rule for automated calls and texts.
based_on: The outreach buttons and rules in src/core/outreach.ts and src/core/candidate-actions.ts
---
Use this when Adrian asks who to contact for a role, or asks you to write or improve a message to a candidate.

How it works
- `get_candidate_actions` lists who to reach, nudge, screen and submit for the open roles, with a first message already written from the candidate's profile and the role.
- Adrian sends everything himself. The app opens LinkedIn, Gmail or his messaging app with the words filled in and logs the touch when he presses the button. You never send, and you never mark something as sent.
- One first message and at most one follow-up per person per role. If there is no reply after that, leave them alone.
- A person is pitched their best-fitting role only, not several at once.

A good first message
- Three or four sentences. Who Adrian is (a recruiter who only places data people), what the role is, why this person, an easy way out.
- Never name the client. Describe it: size, industry, where, pay band.
- Name one specific thing from their profile that matches a must-have. No flattery, no "exciting opportunity", no "I hope this finds you well".
- LinkedIn connection notes are 300 characters at most.
- Save a better version with `save_draft` (kind linkedin_message, with the person id) so it shows up in Outreach drafts for review.

Automated calls and texts
- The AI screen call (Retell) and any automated text may only go to someone who has agreed to one. US rules treat AI-voice calls and automated texts to mobiles as needing prior consent.
- Consent is recorded on the candidate's profile with how and when it was given (for example a ticked box on the application). If it is not there, the call button is locked. Do not work around it; ask for consent in the first message instead.
- A text Adrian types and sends from his own phone is a normal text, but it still carries a line on how to opt out.

After a screen call
- The transcript arrives as a source on the candidate. Compile it into the profile (see the compiling skill): confirmed years per tool, pay, location, and the personality scales the call supports.
