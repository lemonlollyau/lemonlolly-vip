/* lemonlolly growth clinic: free growth check-up.
   Scoring follows the kickoff plan: eight answers scored 1-5,
   growth score = (total - 8) / 32 x 100, biggest limit = lowest answer,
   capacity overrides when it scores 1 or 2, ties go to the cheapest fix first. */
(function () {
  'use strict';

  /* ===== CONFIG: change these, nothing else needs touching ===== */
  var CONFIG = {
    // Lead form: Web3Forms (free, 250 a month). Paste the access key emailed to indy@lemonlolly.com.au.
    // The key is safe to have in public code. Until it's set, leads aren't sent but booking still works.
    ENDPOINT: 'https://api.web3forms.com/submit',
    WEB3FORMS_KEY: '728bb4d3-8ec7-4479-907a-9410512764f3',
    // Calendly event for the 30-minute diagnosis call (7 to 10:30am Adelaide = US afternoons).
    BOOKING_URL: 'https://calendly.com/lemonlolly-au/lemonlolly-diagnosis-call',
    ADS_ID: 'AW-18373661137',
    // Google Ads conversion labels (www.lemonlolly.com.au account, all named "VIP - ..."). Empty = not sent.
    CONVERSIONS: {
      start: 'lrWMCPzbkbwdENGjn7lE',     // VIP - Check-up started (Page view)
      complete: 'pPixCNjdj7wdENGjn7lE',  // VIP - Check-up completed (Submit lead form)
      lead: '81W0CP7akbwdENGjn7lE',      // VIP - Diagnosis details submitted (Sign-up)
      booked: 'wnF2CPnbkbwdENGjn7lE'     // VIP - Diagnosis call booked (Book appointment)
    },
    CURRENCY: 'AUD',
    // Revenue bands below this index are shown their score and offered the written diagnosis, not a call.
    // 0 = everyone gets a call; 1 = under $10k a month doesn't.
    REVENUE_FLOOR: 1,
    CONTACT: 'indy@lemonlolly.com.au'
  };

  /* ===== QUESTIONS ===== */
  var QUESTIONS = [
    { id: 'leads', area: 'Lead flow', q: 'Compared with what you need, how many new inquiries do you get in a typical month?',
      a: ['Far fewer than we need', 'Fewer than we need', 'Enough in a good month', 'Enough most months', 'More than we can handle'] },
    { id: 'cost', area: 'Customer cost', q: 'Do you know what each new customer costs you to win?',
      a: ['No idea', 'A rough guess', 'For some channels', 'For most channels', 'By channel, checked monthly'] },
    { id: 'reply', area: 'Reply speed', q: 'When someone inquires, how fast do they get a reply?',
      a: ['A day or more, or not always', 'Same day', 'Within a few hours', 'Within an hour', 'Within minutes, every time'] },
    { id: 'conversion', area: 'Conversion', q: 'What share of inquiries become paying customers?',
      a: ["I don't know", 'Under 10%', '10 to 25%', '25 to 50%', 'Over 50%'] },
    { id: 'repeat', area: 'Repeat and referral', q: 'Do past customers come back or refer others without being asked?',
      a: ['Rarely', 'Sometimes', "Often, but we don't track it", 'Often, and we ask for it', "It's a main source, with a system behind it"] },
    { id: 'tracking', area: 'Tracking', q: 'Is your marketing spend clearly tied to sales you can count?',
      a: ["We can't tell", 'Gut feel', 'Some of it', 'Most of it', 'Every dollar'] },
    { id: 'ownership', area: 'Ownership', q: 'Who runs your marketing day to day?',
      a: ['No one', 'Me, when I get time', 'Me, consistently', 'Someone on the team or a freelancer', 'A dedicated person or outside team with targets'] },
    { id: 'capacity', area: 'Capacity', q: 'If your leads doubled tomorrow, could the business handle them?',
      a: ["No, we'd drop the ball", "We'd struggle", 'For a few weeks', 'Mostly, with some hiring', 'Yes, easily'] }
  ];
  var TIE_ORDER = ['reply', 'conversion', 'tracking', 'cost', 'leads', 'repeat', 'ownership', 'capacity'];

  var LIMITS = {
    leads: { line: 'Not enough of the right people are finding you.',
      tip: 'List the three places your best customers found you. Put this month’s time and money into the strongest one before trying anything new.' },
    cost: { line: 'You don’t know what a customer costs to win, so you can’t tell which spend is working.',
      tip: 'Divide last month’s marketing spend by the new customers it brought in. That one number tells you what you can afford to pay for growth.' },
    reply: { line: 'Inquiries are going cold before anyone replies.',
      tip: 'Set up an instant reply to every inquiry, with a link to book a time. Speed beats polish.' },
    conversion: { line: 'Inquiries are coming in, but too few become customers.',
      tip: 'Call back your last ten inquiries that didn’t buy and ask what stopped them. The pattern usually shows by call six.' },
    repeat: { line: 'Past customers aren’t bringing in new ones.',
      tip: 'Message your ten happiest customers this week and ask who they know who’d want the same result.' },
    tracking: { line: 'Your spend isn’t tied to sales you can count.',
      tip: 'Add “How did you hear about us?” to every booking or checkout. It’s free, and you’ll have answers within a month.' },
    ownership: { line: 'No one owns growth day to day, so it happens in bursts.',
      tip: 'Block one hour a week, same time every week, just for growth. Treat it like a client meeting.' },
    none: { line: 'Nothing is badly blocked. Your vital signs are strong.',
      tip: 'Grow lead flow in steps, and watch reply speed and delivery as volume rises.' },
    capacity: { line: 'More leads would stretch the business right now. Delivery comes first, and the call will cover how.',
      tip: 'Write down what breaks first when you get busy. Fix that before you pay for a single extra lead.' }
  };

  var BANDS = [
    { max: 39, name: 'Needs treatment', head: 'Growth is blocked in more than one place.' },
    { max: 69, name: 'Leaking', head: 'You’re winning business, but some of it is slipping away.' },
    { max: 100, name: 'Ready to scale', head: 'Your foundations are solid. The next step is more of the right leads.' }
  ];

  var QUALS = [
    { id: 'business', q: 'What kind of business do you run?', two: true,
      a: ['Day spa or med spa', 'Beauty salon or clinic', 'Wellness or health brand', 'Online store', 'Other service business', 'Something else'] },
    { id: 'revenue', q: 'Roughly how much does the business bring in each month?', two: true,
      a: ['Under $10k', '$10k to $50k', '$50k to $250k', 'Over $250k', 'Prefer not to say'] },
    { id: 'zone', q: 'Which time zone are you in?', two: true,
      a: ['Pacific', 'Mountain', 'Central', 'Eastern', 'Alaska or Hawaii', 'Outside the US'] }
  ];

  /* ===== STATE ===== */
  var S = { step: -1, answers: [], quals: {}, started: false, result: null, lead: null };
  var body = document.getElementById('appBody');
  var bar = document.getElementById('bar');
  var barWrap = bar ? bar.parentNode : null;
  var label = document.getElementById('stepLabel');
  var timeLeft = document.getElementById('timeLeft');
  var app = document.getElementById('app');
  if (!body) return;

  /* ===== helpers ===== */
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function store(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function load(k) { try { return JSON.parse(sessionStorage.getItem(k) || 'null'); } catch (e) { return null; } }

  var ATTR = (function () {
    var saved = load('ll_attr') || {};
    try {
      var p = new URLSearchParams(location.search);
      ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'gclid', 'gbraid', 'wbraid'].forEach(function (k) {
        if (p.get(k)) saved[k] = p.get(k);
      });
      if (!saved.landing) saved.landing = location.href;
      if (!saved.referrer && document.referrer) saved.referrer = document.referrer;
    } catch (e) {}
    store('ll_attr', saved);
    return saved;
  })();

  function track(name, key, extra) {
    var data = { event: name };
    if (extra) for (var k in extra) data[k] = extra[k];
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(data);
    var labelId = key && CONFIG.CONVERSIONS[key];
    if (labelId && typeof window.gtag === 'function') {
      window.gtag('event', 'conversion', { send_to: CONFIG.ADS_ID + '/' + labelId, value: 1.0, currency: CONFIG.CURRENCY });
    }
  }

  function setProgress(pct, text, time) {
    bar.style.width = pct + '%';
    if (barWrap) barWrap.setAttribute('aria-valuenow', String(Math.round(pct)));
    label.textContent = text;
    timeLeft.textContent = time || '';
  }

  function focusTop() {
    var h = body.querySelector('legend, h3');
    if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
    var r = app.getBoundingClientRect();
    if (r.top < 0 || r.top > window.innerHeight * 0.6) app.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* ===== scoring ===== */
  function score(answers) {
    var total = answers.reduce(function (s, v) { return s + v; }, 0);
    var pct = Math.round((total - 8) / 32 * 100);
    var byId = {};
    QUESTIONS.forEach(function (q, i) { byId[q.id] = answers[i]; });
    var limit, low = Math.min.apply(null, answers);
    if (byId.capacity <= 2) {
      limit = 'capacity';
    } else if (low >= 4) {
      limit = 'none'; // nothing scored below 4: say so honestly
    } else {
      for (var t = 0; t < TIE_ORDER.length; t++) {
        if (byId[TIE_ORDER[t]] === low) { limit = TIE_ORDER[t]; break; }
      }
    }
    var band = 0;
    while (pct > BANDS[band].max) band++;
    return { pct: pct, total: total, limit: limit, band: band, byId: byId };
  }

  /* ===== screens ===== */
  function renderStart() {
    S.step = -1;
    setProgress(0, 'Growth check-up', 'About 3 minutes');
    body.innerHTML =
      '<div class="start-panel">' +
        '<h3>Ready for your check-up?</h3>' +
        '<p>Answer honestly. There are no wrong answers, and nobody sees them unless you ask for your written diagnosis.</p>' +
        '<ul class="start-list"><li>Lead flow</li><li>Customer cost</li><li>Reply speed</li><li>Conversion</li><li>Repeat and referral</li><li>Tracking</li><li>Ownership</li><li>Capacity</li></ul>' +
        '<div class="btn-row"><button type="button" class="btn btn-ink" id="go">Start the check-up <span class="arr" aria-hidden="true">→</span></button></div>' +
      '</div>';
    document.getElementById('go').addEventListener('click', function () { renderQuestion(0); });
  }

  function renderQuestion(i) {
    S.step = i;
    var q = QUESTIONS[i];
    var remaining = Math.max(1, Math.round((QUESTIONS.length - i) * 0.3 + 0.4));
    setProgress((i / (QUESTIONS.length + 1)) * 100, 'Question ' + (i + 1) + ' of ' + QUESTIONS.length, 'About ' + remaining + (remaining === 1 ? ' minute' : ' minutes') + ' left');
    var opts = q.a.map(function (txt, k) {
      var v = k + 1, checked = S.answers[i] === v ? ' checked' : '';
      return '<label class="opt"><input type="radio" name="q" value="' + v + '"' + checked + '><span>' + esc(txt) + '</span></label>';
    }).join('');
    body.innerHTML =
      '<fieldset class="q"><span class="area">' + esc(q.area) + '</span>' +
        '<legend>' + esc(q.q) + '</legend>' +
        '<div class="opts">' + opts + '</div>' +
      '</fieldset>' +
      '<div class="step-actions">' +
        '<button type="button" class="linkbtn" id="back">← Back</button>' +
        (S.answers[i] ? '<button type="button" class="btn btn-ink" id="next">Next <span class="arr" aria-hidden="true">→</span></button>' : '') +
      '</div>';
    body.querySelectorAll('input[name=q]').forEach(function (inp) {
      inp.addEventListener('change', function () {
        S.answers[i] = Number(inp.value);
        if (!S.started) { S.started = true; track('checkup_start', 'start'); }
        setTimeout(function () { advance(i); }, 260);
      });
    });
    document.getElementById('back').addEventListener('click', function () { i === 0 ? renderStart() : renderQuestion(i - 1); focusTop(); });
    var nx = document.getElementById('next');
    if (nx) nx.addEventListener('click', function () { advance(i); });
    focusTop();
  }

  function advance(i) {
    if (i + 1 < QUESTIONS.length) renderQuestion(i + 1); else renderQuals();
  }

  function renderQuals() {
    S.step = QUESTIONS.length;
    setProgress((QUESTIONS.length / (QUESTIONS.length + 1)) * 100, 'Last step', 'Under a minute left');
    var html = '<h3 style="margin-bottom:8px">Three quick ones about your business</h3><p style="opacity:.8;margin-bottom:24px">These don’t change your score. They help us make the diagnosis fit.</p>';
    QUALS.forEach(function (g) {
      html += '<fieldset class="q qual" data-q="' + g.id + '"><legend>' + esc(g.q) + '</legend><div class="opts' + (g.two ? ' two' : '') + '">' +
        g.a.map(function (txt, k) {
          var checked = S.quals[g.id] === k ? ' checked' : '';
          return '<label class="opt"><input type="radio" name="' + g.id + '" value="' + k + '"' + checked + '><span>' + esc(txt) + '</span></label>';
        }).join('') + '</div></fieldset>';
    });
    html += '<p class="step-err" id="qerr" hidden>Pick an answer for each question to see your score.</p>' +
      '<div class="step-actions"><button type="button" class="linkbtn" id="back">← Back</button>' +
      '<button type="button" class="btn btn-ink" id="see">See my score <span class="arr" aria-hidden="true">→</span></button></div>';
    body.innerHTML = html;
    QUALS.forEach(function (g) {
      body.querySelectorAll('input[name=' + g.id + ']').forEach(function (inp) {
        inp.addEventListener('change', function () {
          S.quals[g.id] = Number(inp.value);
          inp.closest('.qual').classList.remove('missing');
        });
      });
    });
    document.getElementById('back').addEventListener('click', function () { renderQuestion(QUESTIONS.length - 1); });
    document.getElementById('see').addEventListener('click', function () {
      var missing = QUALS.filter(function (g) { return typeof S.quals[g.id] !== 'number'; });
      if (missing.length) {
        missing.forEach(function (g) { body.querySelector('[data-q=' + g.id + ']').classList.add('missing'); });
        document.getElementById('qerr').hidden = false;
        body.querySelector('[data-q=' + missing[0].id + ']').scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }
      renderResult();
    });
    focusTop();
  }

  function eligible() {
    var r = S.quals.revenue;
    // "Prefer not to say" (last option) still gets a call.
    return r === QUALS[1].a.length - 1 || r >= CONFIG.REVENUE_FLOOR;
  }

  function renderResult() {
    var R = S.result = score(S.answers);
    var band = BANDS[R.band], lim = LIMITS[R.limit];
    var limitQ = QUESTIONS.filter(function (q) { return q.id === R.limit; })[0];
    var limitArea = limitQ ? limitQ.area : 'No major limit';
    var canCall = eligible();
    setProgress(100, 'Your result', 'Done');
    track('checkup_complete', 'complete', { growth_score: R.pct, growth_band: band.name, biggest_limit: R.limit });

    var C = 2 * Math.PI * 54, off = C * (1 - R.pct / 100);
    var rows = QUESTIONS.map(function (q, i) {
      var v = S.answers[i], w = Math.round((v - 1) / 4 * 100);
      var cls = (q.id === R.limit ? ' is-limit' : '');
      return '<div class="cat' + cls + '"><span class="cat-name">' + esc(q.area) + '</span><div class="bar' + (v <= 2 ? ' low' : '') + '"><i data-w="' + Math.max(w, 4) + '"></i></div></div>';
    }).join('');

    var gateTitle = canCall ? 'Get your written diagnosis and book your free call' : 'Get your written diagnosis';
    var gateText = canCall
      ? 'We’ll prepare a one-page diagnosis from your answers and walk you through it on a 30-minute video call, booked in your afternoon.'
      : 'We’ll email you a one-page diagnosis with three things you can do yourself. Diagnosis calls are for businesses bringing in $10k or more a month, so we’d rather not take your time yet.';
    var btnText = canCall ? 'Book my free diagnosis call' : 'Email my diagnosis';

    body.innerHTML =
      '<div class="res-top">' +
        '<div class="dial"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54" fill="none" stroke="#FFF9E9" stroke-width="14"/><circle cx="60" cy="60" r="54" fill="none" stroke="#141109" stroke-width="17" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" id="dialEdge" style="transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)"/><circle cx="60" cy="60" r="54" fill="none" stroke="#FFE100" stroke-width="11" stroke-dasharray="' + C.toFixed(1) + '" stroke-dashoffset="' + C.toFixed(1) + '" id="dialFill" style="transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)"/></svg>' +
          '<div class="num"><div><b>' + R.pct + '</b><small>out of 100</small></div></div></div>' +
        '<div><span class="kicker b' + R.band + '">' + esc(band.name) + '</span><h3 class="verdict">' + esc(band.head) + '</h3>' +
          '<p class="verdict-line">Here’s the one thing holding you back most, and something you can do about it today.</p></div>' +
      '</div>' +
      '<div class="res-block limit"><span class="tag">' + (limitQ ? 'Biggest limit' : 'Good news') + '</span><h3>' + esc(limitArea) + '</h3>' +
        '<p class="line">' + esc(lim.line) + '</p>' +
        '<p class="tip"><b>Try this today:</b> ' + esc(lim.tip) + '</p></div>' +
      '<div class="res-block"><h3>Your eight vital signs</h3><div class="cats">' + rows + '</div></div>' +
      '<form class="res-block gate" id="gate" novalidate>' +
        '<h3>' + gateTitle + '</h3><p>' + gateText + '</p>' +
        '<div class="fields">' +
          '<div class="field"><label for="f-name">First name</label><input type="text" id="f-name" name="name" autocomplete="given-name" required></div>' +
          '<div class="field"><label for="f-email">Email</label><input type="email" id="f-email" name="email" autocomplete="email" required></div>' +
          '<div class="field"><label for="f-biz">Business name</label><input type="text" id="f-biz" name="business" autocomplete="organization" required></div>' +
          '<div class="field"><label for="f-web">Website <span class="opt-l">(optional)</span></label><input type="url" id="f-web" name="website" autocomplete="url" placeholder="yourbusiness.com"></div>' +
        '</div>' +
        '<button type="submit" class="btn btn-lemon" id="send">' + btnText + ' <span class="arr" aria-hidden="true">→</span></button>' +
        (canCall ? '<p class="guar">If we take you on and miss the target we agree, every cent of our fee comes back. <a href="/guarantee">See the guarantee</a></p>' : '') +
        '<p class="small">We use these details to prepare your diagnosis. No spam, ever. <a href="/privacy" style="color:inherit">Privacy</a></p>' +
        '<p class="err" id="ferr" hidden></p>' +
        '<input type="checkbox" id="f-trap" name="botcheck" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">' +
      '</form>' +
      '<div id="after"></div>' +
      '<p class="restart"><button type="button" class="linkbtn" id="redo">Retake the check-up</button></p>';

    requestAnimationFrame(function () {
      setTimeout(function () {
        var r1 = document.getElementById('dialFill'), r2 = document.getElementById('dialEdge');
        if (r1) r1.style.strokeDashoffset = off.toFixed(1);
        if (r2) r2.style.strokeDashoffset = off.toFixed(1);
        body.querySelectorAll('.bar i').forEach(function (el) { el.style.width = el.getAttribute('data-w') + '%'; });
      }, 60);
    });

    document.getElementById('gate').addEventListener('submit', function (e) { e.preventDefault(); submitLead(canCall, limitArea); });
    document.getElementById('redo').addEventListener('click', function () {
      S.answers = []; S.quals = {}; S.result = null; S.started = false; renderStart(); focusTop();
    });
    focusTop();
  }

  function submitLead(canCall, limitArea) {
    var el = {
      name: document.getElementById('f-name'), email: document.getElementById('f-email'),
      business: document.getElementById('f-biz'), website: document.getElementById('f-web')
    };
    var name = el.name.value.trim(), email = el.email.value.trim(), biz = el.business.value.trim(), web = el.website.value.trim();
    var bad = [];
    [['name', name], ['business', biz]].forEach(function (p) { el[p[0]].setAttribute('aria-invalid', p[1] ? 'false' : 'true'); if (!p[1]) bad.push(p[0]); });
    var okEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    el.email.setAttribute('aria-invalid', okEmail ? 'false' : 'true');
    if (!okEmail) bad.push('email');
    var err = document.getElementById('ferr');
    if (bad.length) { err.textContent = 'Check the highlighted fields.'; err.hidden = false; el[bad[0]].focus(); return; }
    err.hidden = true;

    var R = S.result, btn = document.getElementById('send');
    btn.disabled = true; btn.firstChild.textContent = 'Sending… ';
    var payload = {
      access_key: CONFIG.WEB3FORMS_KEY,
      subject: 'Growth check-up: ' + biz + ' (' + R.pct + '/100, ' + limitArea + ')',
      from_name: 'lemonlolly.vip growth check-up',
      replyto: email,
      name: name, email: email, business: biz, website: web,
      growth_score: R.pct, band: BANDS[R.band].name, biggest_limit: limitArea,
      offered_call: canCall ? 'yes' : 'no (below revenue floor)',
      business_type: QUALS[0].a[S.quals.business], revenue: QUALS[1].a[S.quals.revenue], time_zone: QUALS[2].a[S.quals.zone]
    };
    QUESTIONS.forEach(function (q, i) { payload['q' + (i + 1) + ' ' + q.area] = S.answers[i] + '/5 – ' + q.a[S.answers[i] - 1]; });
    for (var k in ATTR) payload['src_' + k] = ATTR[k];
    S.lead = { name: name, email: email, biz: biz, web: web };

    // Honeypot: bots fill the hidden field; pretend it worked and send nothing.
    var trap = document.getElementById('f-trap');
    if (trap && trap.checked) { afterLead(canCall, true, limitArea); return; }
    if (!CONFIG.WEB3FORMS_KEY) { afterLead(canCall, false, limitArea); return; }

    fetch(CONFIG.ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify(payload) })
      .then(function (res) { return res.json(); })
      .then(function (d) { if (!d || !d.success) throw new Error('send failed'); })
      .then(function () { track('lead_submit', 'lead', { growth_score: R.pct }); afterLead(canCall, true, limitArea); })
      .catch(function () { afterLead(canCall, false, limitArea); });
  }

  function afterLead(canCall, sent, limitArea) {
    var f = document.getElementById('gate'), out = document.getElementById('after');
    if (!sent && !canCall) {
      var btn = document.getElementById('send');
      btn.disabled = false; btn.firstChild.textContent = 'Email my diagnosis ';
      var err = document.getElementById('ferr');
      err.innerHTML = 'That didn’t send. Try again, or email <a href="mailto:' + CONFIG.CONTACT + '">' + CONFIG.CONTACT + '</a>.';
      err.hidden = false;
      return;
    }
    f.hidden = true;
    if (!canCall) {
      out.innerHTML = '<div class="res-block done"><h3>Your diagnosis is on its way.</h3><p>Look out for an email from ' + CONFIG.CONTACT + ' within one business day. Check your spam folder if it doesn’t arrive.</p></div>';
      return;
    }
    out.innerHTML =
      '<div class="booking"><div class="booking-head"><h3>Pick a time for your diagnosis call</h3>' +
      '<p>Times show in your own time zone. ' + (sent ? 'We’ll have your written diagnosis ready before we talk.' : 'Your details didn’t reach us, so add them when you book.') + '</p></div>' +
      '<div class="cal" id="cal"></div></div>';
    loadCalendly(function () {
      var L = S.lead || {};
      window.Calendly.initInlineWidget({
        url: CONFIG.BOOKING_URL + (CONFIG.BOOKING_URL.indexOf('?') > -1 ? '&' : '?') + 'hide_gdpr_banner=1',
        parentElement: document.getElementById('cal'),
        prefill: { name: L.name || '', email: L.email || '', customAnswers: { a1: (L.biz || '') + (L.web ? ' – ' + L.web : '') + ' | score ' + S.result.pct + ', limit: ' + limitArea } }
      });
    });
    out.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function loadCalendly(cb) {
    if (window.Calendly) return cb();
    var css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://assets.calendly.com/assets/external/widget.css';
    document.head.appendChild(css);
    var s = document.createElement('script');
    s.src = 'https://assets.calendly.com/assets/external/widget.js'; s.async = true;
    s.onload = cb;
    s.onerror = function () {
      var cal = document.getElementById('cal');
      if (cal) cal.innerHTML = '<p style="padding:20px">The calendar didn’t load. <a class="textlink" href="' + CONFIG.BOOKING_URL + '" target="_blank" rel="noopener">Open it in a new tab</a>.</p>';
    };
    document.head.appendChild(s);
  }

  window.addEventListener('message', function (e) {
    if (e.origin !== 'https://calendly.com' || !e.data || e.data.event !== 'calendly.event_scheduled') return;
    track('call_booked', 'booked', { growth_score: S.result ? S.result.pct : null });
    var out = document.getElementById('after');
    if (out) {
      var done = document.createElement('div');
      done.className = 'res-block done';
      done.innerHTML = '<h3>You’re booked in.</h3><p>The calendar invite is in your inbox. We’ll have your written diagnosis ready for the call.</p>';
      out.appendChild(done);
    }
  });

  /* any "take the check-up" link starts it */
  document.querySelectorAll('[data-start]').forEach(function (a) {
    a.addEventListener('click', function () { if (S.step === -1) setTimeout(function () { var g = document.getElementById('go'); if (g) g.focus({ preventScroll: true }); }, 400); });
  });

  renderStart();

  // exposed for testing only
  window.__llScore = score;
})();
