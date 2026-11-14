// AI-assisted: written with Claude Code (Anthropic) and reviewed/tested by our team.
// spaceweather.js – "current conditions": live space weather heading for Mars.
//
// Source: NASA's DONKI database (Space Weather Database Of Notifications,
// Knowledge, Information), run by the Community Coordinated Modeling Center
// at NASA Goddard. Every time a coronal mass ejection (CME) leaves the Sun,
// forecasters run the WSA-ENLIL solar-wind model, which predicts when the CME
// reaches the planets and spacecraft. We list the runs that say "Mars".
//
// API: https://api.nasa.gov/DONKI/WSAEnlilSimulations (max 60-day window).
// DEMO_KEY works without sign-up but allows only a few calls per hour per
// visitor, so results are cached in the browser for an hour.
//
// Important: these are MODEL PREDICTIONS of CME arrival, not radiation
// measurements. CMEs can drive solar energetic particle events, which can
// raise the dose at the Martian surface well above the quiet RAD average.

const API = 'https://api.nasa.gov/DONKI/WSAEnlilSimulations';
const API_KEY = 'DEMO_KEY'; // free public key; replace with your own api.nasa.gov key if rate-limited
const CACHE_KEY = 'marswalk-spaceweather-v1';
const CACHE_MS = 60 * 60 * 1000;
const DAY = 24 * 60 * 60 * 1000;

const isoDate = (d) => d.toISOString().slice(0, 10);

async function fetchMarsArrivals() {
  // 1. Cached copy younger than an hour? (localStorage can be blocked → try/catch)
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.savedAt < CACHE_MS) return cached.arrivals;
  } catch { /* ignore */ }

  // 2. Ask DONKI for the last 30 days of model runs
  const end = new Date();
  const start = new Date(end.getTime() - 30 * DAY);
  const url = `${API}?startDate=${isoDate(start)}&endDate=${isoDate(end)}&api_key=${API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`DONKI returned ${res.status}`);
  const sims = await res.json();

  // 3. Keep impacts at Mars; several runs may model the same CME, so keep the
  //    newest run per CME (identified by its start time)
  const byCme = new Map();
  for (const sim of sims) {
    for (const hit of sim.impactList || []) {
      if (hit.location !== 'Mars') continue;
      const cme = sim.cmeInputs?.[0] || {};
      const key = cme.cmeStartTime || hit.arrivalTime;
      const prev = byCme.get(key);
      if (!prev || sim.modelCompletionTime > prev.modelRun) {
        byCme.set(key, {
          cmeStart: cme.cmeStartTime,
          speedKms: cme.speed,
          arrival: hit.arrivalTime,
          glancing: hit.isGlancingBlow,
          modelRun: sim.modelCompletionTime,
          link: sim.link,
        });
      }
    }
  }
  const arrivals = [...byCme.values()].sort((a, b) => (a.arrival < b.arrival ? 1 : -1));
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), arrivals })); } catch { /* ignore */ }
  return arrivals;
}

// Turn the list into a simple status for the checklist:
//   'alert' – a CME is predicted to reach Mars between 1 day ago and 3 days from now
//   'quiet' – nothing predicted in that window
export function spaceWeatherStatus(arrivals) {
  const now = Date.now();
  const soon = arrivals.filter((a) => {
    const t = Date.parse(a.arrival);
    return t > now - DAY && t < now + 3 * DAY;
  });
  return { level: soon.length ? 'alert' : 'quiet', soon };
}

const fmt = (iso) => iso.replace('T', ' ').replace('Z', ' UTC');

// Fill the space-weather card and report the status back (for the checklist)
export async function initSpaceWeather(el, onStatus) {
  el.innerHTML = '<h2>Current conditions: space weather</h2><p class="small">Loading NASA DONKI…</p>';
  try {
    const arrivals = await fetchMarsArrivals();
    const status = spaceWeatherStatus(arrivals);
    const latest = arrivals.slice(0, 3);
    el.innerHTML = `
      <h2>Current conditions: space weather</h2>
      <div class="card ${status.level === 'alert' ? 'sw-alert' : ''}">
        ${status.level === 'alert'
          ? `<b class="warn">⚠ CME arrival at Mars predicted around ${fmt(status.soon[0].arrival)}</b>
             <p>Avoid long EVAs near this time and stay close to shelter: CMEs can bring
             solar energetic particles that raise the surface radiation dose.</p>`
          : '<b class="ok">✓ No CME predicted to reach Mars in the next 3 days.</b>'}
        <p class="small">Model predictions at Mars in the last 30 days: ${arrivals.length}.
        ${latest.map((a) => `<br>• CME of ${fmt(a.cmeStart || '?')} → Mars ${fmt(a.arrival)}${a.glancing ? ' (glancing blow)' : ''}
          · <a href="${a.link}" target="_blank" rel="noopener">model run</a>`).join('')}</p>
        <p class="small">Source: NASA DONKI WSA-ENLIL solar-wind model (CCMC, NASA Goddard). These are forecasts,
        not radiation measurements.</p>
      </div>`;
    onStatus(status);
  } catch (err) {
    el.innerHTML = `
      <h2>Current conditions: space weather</h2>
      <div class="card"><p class="small">Live space-weather data is unavailable right now (${err.message}).
      Check <a href="https://kauai.ccmc.gsfc.nasa.gov/DONKI/" target="_blank" rel="noopener">NASA DONKI</a> before an EVA.</p></div>`;
    onStatus({ level: 'unknown', soon: [] });
  }
}
