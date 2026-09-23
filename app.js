const body = document.getElementById('chatBody');
const input = document.getElementById('chatInput');
const talkHuman = document.getElementById('talkHuman');
const annotRail = document.getElementById('annotRail');
const langSelect = document.getElementById('langSelect');
const statusPill = document.getElementById('statusPill');

let selectedType = null;
let selectedSlot = null;
let escalated = false;

const LANG_NAMES = {
  en: 'English',
  vi: 'Vietnamese (Tiếng Việt)',
  zh: 'Mandarin (中文)',
  ar: 'Arabic (العربية)',
};

// My individual feature: language selector (stub for the team's
// "multilingual support" growth feature — UI hook only, responses
// stay in English in this demo)
langSelect.addEventListener('change', async () => {
  setActiveAnnotation('lang');
  const name = LANG_NAMES[langSelect.value];
  const note = document.createElement('div');
  note.className = 'lang-note';
  note.innerHTML = langSelect.value === 'en'
    ? 'Language reset to English.'
    : `Switched to <strong>${name}</strong>. In production, Frontdesk's conversational AI engine would respond fluently in this language — this demo preview stays in English for readability.`;
  body.appendChild(note);
  scrollDown();
});

// My individual feature: cross-screen sync. Writes escalation events to
// localStorage so the Practice Manager Dashboard (dashboard.html) can
// show them in its live queue and activity log, demonstrating that both
// screens share one underlying data source rather than being separate demos.
function pushEscalationToDashboard(requestSummary) {
  try {
    const key = 'frontdesk_escalations';
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    const now = new Date();
    existing.push({
      time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toLowerCase().replace(' ', ''),
      channel: 'Chat',
      request: requestSummary,
    });
    localStorage.setItem(key, JSON.stringify(existing.slice(-10)));
  } catch (e) {
    // localStorage unavailable — demo still works within this page
  }
}

function setActiveAnnotation(step) {
  annotRail.querySelectorAll('.annot').forEach(a => {
    a.classList.toggle('active', a.dataset.step === step);
  });
}

function scrollDown() {
  body.scrollTop = body.scrollHeight;
}

function addBot(html, delay = 550) {
  return new Promise(resolve => {
    const typing = document.createElement('div');
    typing.className = 'typing';
    typing.innerHTML = '<span></span><span></span><span></span>';
    body.appendChild(typing);
    scrollDown();
    setTimeout(() => {
      typing.remove();
      const el = document.createElement('div');
      el.className = 'msg bot';
      el.innerHTML = html;
      body.appendChild(el);
      scrollDown();
      resolve();
    }, delay);
  });
}

function addUser(text) {
  const el = document.createElement('div');
  el.className = 'msg user';
  el.textContent = text;
  body.appendChild(el);
  scrollDown();
}

function addChips(options, handler, extraClass = '') {
  const wrap = document.createElement('div');
  wrap.className = 'chips';
  options.forEach(opt => {
    const chip = document.createElement('button');
    chip.className = 'chip ' + extraClass;
    chip.textContent = opt.label;
    chip.onclick = () => handler(opt, chip, wrap);
    wrap.appendChild(chip);
  });
  body.appendChild(wrap);
  scrollDown();
  return wrap;
}

function addEscalationBanner() {
  const el = document.createElement('div');
  el.className = 'escalation-banner';
  el.textContent = 'If you describe symptoms or an urgent issue, Frontdesk stops and hands the chat to reception staff — with the full conversation attached.';
  body.appendChild(el);
  scrollDown();
}

async function startFlow() {
  setActiveAnnotation('home');
  await addBot("Hi! I'm Frontdesk. I can book, reschedule, or answer questions about the clinic. What do you need today?", 300);
  addChips([
    { label: 'Book appointment', action: 'book' },
    { label: 'Reschedule', action: 'reschedule' },
    { label: 'Prescription refill', action: 'refill' },
    { label: 'Clinic hours', action: 'hours' },
  ], handleHomeChoice);
  addEscalationBanner();
}

async function handleHomeChoice(opt, chip, wrap) {
  wrap.querySelectorAll('.chip').forEach(c => c.disabled = true);
  addUser(chip.textContent);

  if (opt.action === 'hours') {
    await addBot("The clinic is open Monday–Friday, 8:00am–6:00pm, and Saturday, 9:00am–1:00pm. Would you like to book something in?");
    addChips([{ label: 'Book appointment', action: 'book' }], handleHomeChoice);
    return;
  }
  if (opt.action === 'refill') {
    await addBot("I can pass a prescription refill request to your clinic's reception team — this needs a clinician's review, so it isn't something I can confirm automatically. Would you like me to send it through?");
    addChips([{ label: 'Yes, send it', action: 'sendRefill' }], async (o, c, w) => {
      w.querySelectorAll('.chip').forEach(x => x.disabled = true);
      addUser(c.textContent);
      await addBot('Done — your refill request has been sent to reception. They\'ll be in touch shortly.');
    });
    return;
  }
  // book or reschedule → go to booking flow
  await addBot("Sure! What type of appointment do you need?");
  setActiveAnnotation('booking');
  addChips([
    { label: 'General consultation' },
    { label: 'Physio appointment' },
    { label: 'Nurse / vaccination' },
  ], handleTypeChoice);
}

async function handleTypeChoice(opt, chip, wrap) {
  wrap.querySelectorAll('.chip').forEach(c => c.disabled = true);
  addUser(chip.textContent);
  selectedType = chip.textContent;

  await addBot(`Here are the next available slots for a <strong>${selectedType}</strong>:`);
  const slotWrap = addChips([
    { label: 'Tue 10:00am' },
    { label: 'Wed 2:30pm' },
    { label: 'Thu 9:15am' },
  ], handleSlotChoice, 'slot-chip');
}

async function handleSlotChoice(opt, chip, wrap) {
  wrap.querySelectorAll('.chip').forEach(c => c.classList.remove('selected'));
  chip.classList.add('selected');
  selectedSlot = chip.textContent;
  await addBot(`Great — <strong>${selectedSlot}</strong> for your ${selectedType}. Shall I confirm this booking?`);
  addChips([{ label: 'Confirm booking' }], handleConfirm);
}

async function handleConfirm(opt, chip, wrap) {
  wrap.querySelectorAll('.chip').forEach(c => c.disabled = true);
  addUser('Confirm booking');
  setActiveAnnotation('confirm');
  await addBot('Booking confirmed and synced with the clinic calendar. ✓');

  const card = document.createElement('div');
  card.className = 'confirm-card';
  card.innerHTML = `
    <div class="confirm-check">Appointment Confirmed ✓</div>
    <div class="row"><span class="label">Type</span><span>${selectedType}</span></div>
    <div class="row"><span class="label">Time</span><span>${selectedSlot}</span></div>
    <div class="label" style="margin-top:8px;">Before your visit:</div>
    <ul>
      <li>Bring your Medicare card if required by the clinic</li>
      <li>Arrive a little early if you are a new patient</li>
    </ul>
  `;
  body.appendChild(card);
  scrollDown();

  await addBot("You'll also get an SMS reminder before your appointment. Anything else I can help with?", 400);
}

talkHuman.addEventListener('click', async () => {
  if (escalated) return;
  escalated = true;
  setActiveAnnotation('escalate');
  addUser('Talk to a person');
  input.disabled = true;
  talkHuman.textContent = 'Connecting…';
  statusPill.textContent = 'Escalated';
  statusPill.classList.add('show', 'escalated');
  await addBot("No problem — I'm handing this conversation to a staff member now, along with everything we've discussed so far. Someone will be with you shortly.", 500);
  const banner = document.createElement('div');
  banner.className = 'escalation-banner';
  banner.style.background = '#fff4e0';
  banner.style.borderColor = '#f0d9ad';
  banner.style.color = '#8a5f14';
  banner.textContent = '● Escalated to reception — full conversation history attached';
  body.appendChild(banner);
  scrollDown();
  talkHuman.textContent = 'Connected to staff';

  const summary = selectedType
    ? `Chat escalation during ${selectedType} booking — requested a person`
    : 'Chat escalation — patient requested a person';
  pushEscalationToDashboard(summary);
});

input.addEventListener('keydown', async (e) => {
  if (e.key === 'Enter' && input.value.trim()) {
    const text = input.value.trim();
    addUser(text);
    input.value = '';
    await addBot("Thanks — for this demo, please use the quick-reply buttons above to walk through the booking flow. In production, this free-text box is handled by the conversational AI engine.");
  }
});

startFlow();
