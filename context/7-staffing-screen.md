---
kind: skill
name: Spotting staffing firms
summary: How to tell a staffing firm, recruiter or job board from a direct employer, and what to do with one.
based_on: The screen in linkedin-hiring-posts-search and the job alert results
---
SheerFlow sells to companies that hire data people for themselves. A firm that places people at other companies, or re-posts other companies' jobs, is a competitor or noise, never a prospect.

It is a staffing firm or job board when
- The name or tagline has staffing, recruiting, talent, workforce, search partners, RPO, placement or "jobs".
- The job text says "our client", "about the company:" followed by a different company's name, or asks for resumes to be sent to an agency.
- The role is contract or C2C through a third party.
- The poster's title is recruiter, talent acquisition, sourcer, headhunter or bench sales, and they do not work at the hiring company.
- The company page only posts openings and has no product or service of its own.

It is not one just because the name has "consulting", "solutions" or "technologies". Check what the company sells.

What to do
- Before saving companies, signals or jobs, run the names through `check_staffing_firms`.
- When you confirm a new one, `add_staffing_firm` with a one-line reason. The app then drops anything that arrives under that name.
- When the app has a real employer listed as "suspected", say so in your job result; only Adrian changes that, on the Staffing firms screen.
