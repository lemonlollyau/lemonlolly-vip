# lemonlolly growth clinic (lemonlolly.vip)

US landing site for the growth clinic test: YouTube ads → free growth check-up → diagnosis call.
Static HTML, hosted on Vercel, source of truth on GitHub. Push to `main` = publish.

- `index.html` — landing page with the check-up
- `app.js` — check-up engine. Everything you'd change is in `CONFIG` at the top:
  Web3Forms access key, Calendly link, Google Ads conversion labels, revenue floor
- `guarantee.html` — guarantee terms (/guarantee). Draft until reviewed by a US lawyer
- `privacy.html` — privacy notice (/privacy)
- `styles.css` — lemonlolly brand system v1.0

Scoring (from the kickoff plan): 8 answers scored 1–5; growth score = (total − 8) / 32 × 100.
Biggest limit = lowest answer; capacity wins if it scores 1 or 2; ties go reply speed →
conversion → tracking → customer cost → lead flow → repeat and referral → ownership.

Events pushed to dataLayer: checkup_start, checkup_complete, lead_submit, call_booked.
