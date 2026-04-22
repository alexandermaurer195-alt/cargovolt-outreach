// ─── State ────────────────────────────────────────────────────────────────────
let carrierLibrary = [];
let activeListId = null;
let activeDetailId = null;
let filteredCarriers = [];
let pendingCarriers = [];
let offers = [];              // { id, carrierName, rate, notes, ts }

const STORAGE_KEY = 'cv_carrier_library';
const OFFERS_KEY  = 'cv_offers';

// ─── Boot ─────────────────────────────────────────────────────────────────────
function boot() {
  loadSettings();
  loadLibrary();
  loadOffers();
  refreshComposeListSelector();
  renderLibraryGrid();
  syncOfferLane();
  initMsal();
}

// ─── Tab navigation ───────────────────────────────────────────────────────────
document.querySelectorAll('.nav-item').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

function switchTab(name) {
  document.querySelectorAll('.nav-item').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById('tab-' + name).classList.add('active');
}

// ─── Library persistence ──────────────────────────────────────────────────────
function loadLibrary() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    carrierLibrary = raw ? JSON.parse(raw) : [];
  } catch (e) {
    carrierLibrary = [];
  }
}

function saveLibrary() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(carrierLibrary));
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Library grid ─────────────────────────────────────────────────────────────
function renderLibraryGrid() {
  const grid = document.getElementById('libraryGrid');
  const empty = document.getElementById('libraryEmpty');
  const cards = document.getElementById('listCards');

  if (carrierLibrary.length === 0) {
    grid.style.display = 'none';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.style.display = 'block';

  cards.innerHTML = carrierLibrary.map(list => {
    const isActive = list.id === activeListId;
    const lastSent = list.lastSentAt ? 'Last sent ' + timeAgo(list.lastSentAt) : 'Never sent';
    const created = 'Added ' + timeAgo(list.createdAt);
    return `
      <div class="list-card ${isActive ? 'list-card-active' : ''}" onclick="openListDetail('${list.id}')">
        <div class="list-card-main">
          <div class="list-card-name">${escHtml(list.name)}</div>
          <div class="list-card-meta">${list.carriers.length} carriers &middot; ${created} &middot; ${lastSent}</div>
        </div>
        <div class="list-card-actions">
          ${isActive ? '<span class="pill pill-green" style="font-size:11px;">In use</span>' : ''}
          <button class="btn-ghost" style="padding:6px 12px; font-size:12px;" onclick="event.stopPropagation(); useListForCompose('${list.id}')">Use for outreach</button>
          <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="color:var(--text-3); flex-shrink:0;"><path d="M9 5l7 7-7 7"/></svg>
        </div>
      </div>`;
  }).join('');
}

// ─── List detail view ─────────────────────────────────────────────────────────
function openListDetail(id) {
  const list = carrierLibrary.find(l => l.id === id);
  if (!list) return;
  activeDetailId = id;

  document.getElementById('libraryGrid').style.display = 'none';
  document.getElementById('libraryEmpty').style.display = 'none';
  document.getElementById('listDetailView').style.display = 'block';
  document.getElementById('detailListName').textContent = list.name;
  document.getElementById('detailListMeta').textContent = list.carriers.length + ' carriers · Added ' + timeAgo(list.createdAt);
  document.getElementById('filterInput').value = '';
  renderCarrierTable(list.carriers);
}

function closeListDetail() {
  activeDetailId = null;
  document.getElementById('listDetailView').style.display = 'none';
  renderLibraryGrid();
}

function renderCarrierTable(data) {
  const tbody = document.getElementById('carrierRows');
  document.getElementById('detailCount').textContent = data.length + ' carriers';

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="color:var(--text-3); padding:20px 16px;">No carriers match your filter.</td></tr>';
    return;
  }

  tbody.innerHTML = data.slice(0, 300).map(c => {
    const pillClass = c.status === 'sent' ? 'pill-blue' : c.status === 'replied' ? 'pill-green' : 'pill-gray';
    return `<tr>
      <td>${escHtml(c.name)}</td>
      <td style="color:var(--text-2); font-family:'DM Mono',monospace; font-size:12px;">${escHtml(c.email)}</td>
      <td>${escHtml(c.market)}</td>
      <td><span class="pill ${pillClass}">${c.status}</span></td>
    </tr>`;
  }).join('');
}

function filterCarriers() {
  const list = carrierLibrary.find(l => l.id === activeDetailId);
  if (!list) return;
  const q = document.getElementById('filterInput').value.toLowerCase().trim();
  const filtered = q
    ? list.carriers.filter(c => c.name.toLowerCase().includes(q) || c.market.toLowerCase().includes(q) || c.email.toLowerCase().includes(q))
    : [...list.carriers];
  renderCarrierTable(filtered);
}

function deleteActiveList() {
  if (!activeDetailId) return;
  const list = carrierLibrary.find(l => l.id === activeDetailId);
  if (!list) return;
  if (!confirm('Delete "' + list.name + '"? This cannot be undone.')) return;
  carrierLibrary = carrierLibrary.filter(l => l.id !== activeDetailId);
  if (activeListId === activeDetailId) {
    activeListId = null;
    refreshComposeListSelector();
  }
  saveLibrary();
  closeListDetail();
}

function selectListForCompose() {
  useListForCompose(activeDetailId);
  closeListDetail();
  switchTab('compose');
}

function useListForCompose(id) {
  activeListId = id;
  refreshComposeListSelector();
  renderLibraryGrid();
}

// ─── Compose list selector ────────────────────────────────────────────────────
function refreshComposeListSelector() {
  const sel = document.getElementById('carrierListSelect');
  sel.innerHTML = '<option value="">— Select a saved list —</option>' +
    carrierLibrary.map(l =>
      `<option value="${l.id}" ${l.id === activeListId ? 'selected' : ''}>${escHtml(l.name)} (${l.carriers.length})</option>`
    ).join('');
  updateSelectedListCount();
}

function selectCarrierList() {
  activeListId = document.getElementById('carrierListSelect').value || null;
  updateSelectedListCount();
}

function updateSelectedListCount() {
  const el = document.getElementById('selectedListCount');
  if (activeListId) {
    const list = carrierLibrary.find(l => l.id === activeListId);
    el.textContent = list ? list.carriers.length + ' carriers' : '';
  } else {
    el.textContent = '';
  }
}

// ─── File upload ──────────────────────────────────────────────────────────────
function handleFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = '';

  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => {
      pendingCarriers = parseCSV(e.target.result);
      if (pendingCarriers.length > 0) showSaveModal(file.name);
    };
    reader.readAsText(file);
  } else {
    alert('Please save your file as CSV (File > Save As > CSV) and re-upload.');
  }
}

function parseCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) { alert('File appears empty.'); return []; }

  const headers = lines[0].toLowerCase().split(',').map(h => h.trim().replace(/"/g, ''));
  const nameIdx = headers.findIndex(h => h.includes('name') || h === 'carrier');
  const emailIdx = headers.findIndex(h => h.includes('email'));
  const marketIdx = headers.findIndex(h => h.includes('market') || h.includes('lane') || h.includes('region'));

  if (emailIdx === -1) {
    alert('Could not find an email column. Make sure your CSV has a column named "email".');
    return [];
  }

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const raw = lines[i];
    if (!raw.trim()) continue;
    const cols = splitCSVRow(raw);
    const email = cols[emailIdx] ? cols[emailIdx].trim().replace(/"/g, '') : '';
    if (!email || !email.includes('@')) continue;
    result.push({
      name: nameIdx >= 0 ? (cols[nameIdx] || 'Carrier ' + i).trim().replace(/"/g, '') : 'Carrier ' + i,
      email,
      market: marketIdx >= 0 ? (cols[marketIdx] || '—').trim().replace(/"/g, '') : '—',
      status: 'pending'
    });
  }

  if (result.length === 0) alert('No valid carriers found. Check that your file has name and email columns.');
  return result;
}

function splitCSVRow(row) {
  const result = [];
  let cur = '', inQ = false;
  for (let ch of row) {
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += ch;
  }
  result.push(cur);
  return result;
}

// ─── Save modal ───────────────────────────────────────────────────────────────
function showSaveModal(filename) {
  const pickup = document.getElementById('pickupCity').value.trim();
  const delivery = document.getElementById('deliveryCity').value.trim();
  const equip = document.getElementById('equipField').value;

  let suggested = '';
  if (pickup && delivery) {
    suggested = pickup + ' > ' + delivery + ' — ' + equip;
  } else {
    suggested = filename.replace(/\.(csv|xlsx?)$/i, '').replace(/[-_]/g, ' ');
  }

  document.getElementById('saveListName').value = suggested;
  document.getElementById('saveListCarrierCount').textContent = pendingCarriers.length + ' carriers will be saved';
  document.getElementById('saveListModal').style.display = 'flex';

  setTimeout(() => {
    const input = document.getElementById('saveListName');
    input.focus();
    input.select();
  }, 50);
}

function confirmSaveList() {
  const name = document.getElementById('saveListName').value.trim();
  if (!name) { alert('Enter a name for this list.'); return; }

  const newList = {
    id: genId(),
    name,
    carriers: pendingCarriers,
    createdAt: Date.now(),
    lastSentAt: null
  };

  carrierLibrary.unshift(newList);
  saveLibrary();
  pendingCarriers = [];

  document.getElementById('saveListModal').style.display = 'none';

  activeListId = newList.id;
  refreshComposeListSelector();
  renderLibraryGrid();
  switchTab('carriers');
}

// ─── Sample data ──────────────────────────────────────────────────────────────
function loadSampleData(event) {
  event.stopPropagation();
  pendingCarriers = [
    { name: 'J&T Trucking', email: 'dispatch@jt-trucking.com', market: 'Atlanta', status: 'pending' },
    { name: 'Blue Ridge Carriers', email: 'ops@blueridgecarriers.com', market: 'Charlotte', status: 'pending' },
    { name: 'Southeast Ag Freight', email: 'loads@seagfreight.com', market: 'Atlanta', status: 'pending' },
    { name: 'Palmetto Flatbed', email: 'info@palmettoflatbed.com', market: 'Charleston', status: 'pending' },
    { name: 'Mountain State Trucking', email: 'dispatch@mstrucking.net', market: 'Roanoke', status: 'pending' },
    { name: 'Coastal Express Freight', email: 'booking@coastalef.com', market: 'Savannah', status: 'pending' },
    { name: 'Appalachian Haul', email: 'loads@appalachianhaul.com', market: 'Knoxville', status: 'pending' },
    { name: 'Carolina Flatbed Co.', email: 'rates@carolinaflatbed.com', market: 'Charlotte', status: 'pending' },
    { name: 'Peach State Logistics', email: 'dispatch@peachstatelogistics.com', market: 'Atlanta', status: 'pending' },
    { name: 'Gulf Coast Carriers', email: 'ops@gulfcoastcarriers.com', market: 'Mobile', status: 'pending' },
  ];
  showSaveModal('Sample Atlanta Flatbed');
}

// ─── Compose helpers ──────────────────────────────────────────────────────────
function insertTag(tag) {
  const ta = document.getElementById('emailBody');
  const s = ta.selectionStart, e = ta.selectionEnd;
  ta.value = ta.value.slice(0, s) + tag + ta.value.slice(e);
  ta.focus();
  ta.setSelectionRange(s + tag.length, s + tag.length);
}

function getFilledBody(name) {
  const pickup = document.getElementById('pickupCity').value || '[Pickup city]';
  const delivery = document.getElementById('deliveryCity').value || '[Delivery city]';
  const equip = document.getElementById('equipField').value;
  const contact = document.getElementById('contactName').value || '[Your name]';
  const distance = document.getElementById('distanceField').value || '';
  const loadCount = document.getElementById('loadCount').value || '[loads]';
  const commodity = document.getElementById('commodity').value || '[Commodity]';
  const startDate = document.getElementById('startDate').value || '[start date]';
  const market = document.getElementById('marketField').value || '[Market]';

  const rateLow = document.getElementById('rateLow').value.trim();
  const rateHigh = document.getElementById('rateHigh').value.trim();
  const rateStr = rateLow && rateHigh ? rateLow + '–' + rateHigh
                : rateLow ? rateLow
                : '[Rate]';

  const distNum = parseFloat(distance);
  const oneTruckLine = (!isNaN(distNum) && distNum <= 80)
    ? ' One truck can run the whole project.'
    : '';

  return document.getElementById('emailBody').value
    .replace(/\{carrier_name\}/g, name || '[Carrier]')
    .replace(/\{pickup_city\}/g, pickup)
    .replace(/\{delivery_city\}/g, delivery)
    .replace(/\{equipment\}/g, equip)
    .replace(/\{contact_name\}/g, contact)
    .replace(/\{distance\}/g, distance || '[distance]')
    .replace(/\{load_count\}/g, loadCount)
    .replace(/\{commodity\}/g, commodity)
    .replace(/\{start_date\}/g, startDate)
    .replace(/\{rate\}/g, rateStr)
    .replace(/\{market\}/g, market)
    .replace(/\{one_truck_line\}/g, oneTruckLine);
}

function getFilledSubject() {
  const pickup = document.getElementById('pickupCity').value || '[Pickup]';
  const delivery = document.getElementById('deliveryCity').value || '[Delivery]';
  const market = document.getElementById('marketField').value || '[Market]';
  const rateLow = document.getElementById('rateLow').value.trim();
  const rateHigh = document.getElementById('rateHigh').value.trim();
  const rateStr = rateLow && rateHigh ? rateLow + '–' + rateHigh
                : rateLow ? rateLow
                : '[Rate]';
  return document.getElementById('subject').value
    .replace(/\{pickup_city\}/g, pickup)
    .replace(/\{delivery_city\}/g, delivery)
    .replace(/\{rate\}/g, rateStr)
    .replace(/\{market\}/g, market);
}

// ─── Offers ───────────────────────────────────────────────────────────────────
function loadOffers() {
  try {
    offers = JSON.parse(localStorage.getItem(OFFERS_KEY) || '[]');
  } catch(e) { offers = []; }
}

function saveOffers() {
  localStorage.setItem(OFFERS_KEY, JSON.stringify(offers));
}

function syncOfferLane() {
  const pickup = document.getElementById('pickupCity').value.trim();
  const delivery = document.getElementById('deliveryCity').value.trim();
  const equip = document.getElementById('equipField').value;
  const rateLow = document.getElementById('rateLow').value.trim();
  const rateHigh = document.getElementById('rateHigh').value.trim();

  const laneEl = document.getElementById('offerLaneHeader');
  if (!laneEl) return;

  if (pickup || delivery) {
    const lane = (pickup || '—') + ' → ' + (delivery || '—');
    const rateRange = rateLow && rateHigh ? rateLow + '–' + rateHigh : rateLow || '';
    laneEl.innerHTML = `
      <div class="offer-lane">
        <div class="offer-lane-route">${escHtml(lane)}</div>
        <div class="offer-lane-meta">${escHtml(equip)}${rateRange ? ' &middot; Asking ' + escHtml(rateRange) : ''}</div>
      </div>`;
  } else {
    laneEl.innerHTML = '<div class="offer-lane"><div class="offer-lane-route" style="color:var(--text-3);">Fill in pickup and delivery on the Compose tab to set the active lane</div></div>';
  }

  renderOffers();
}

function renderOffers() {
  const empty = document.getElementById('offersEmpty');
  const content = document.getElementById('offersContent');
  const badge = document.getElementById('navOfferCount');

  if (offers.length === 0) {
    empty.style.display = 'block';
    content.style.display = 'none';
    badge.style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  content.style.display = 'block';
  badge.style.display = 'inline';
  badge.textContent = offers.length;

  const rates = offers.map(o => parseDollar(o.rate)).filter(r => !isNaN(r));
  const avg = rates.length ? Math.round(rates.reduce((a,b) => a+b, 0) / rates.length) : null;
  const low = rates.length ? Math.min(...rates) : null;
  const high = rates.length ? Math.max(...rates) : null;

  document.getElementById('offerAvg').textContent = avg != null ? '$' + avg.toLocaleString() : '—';
  document.getElementById('offerLow').textContent = low != null ? '$' + low.toLocaleString() : '—';
  document.getElementById('offerHigh').textContent = high != null ? '$' + high.toLocaleString() : '—';
  document.getElementById('offerCount').textContent = offers.length;

  document.getElementById('offerRows').innerHTML = [...offers].reverse().map(o => `
    <tr>
      <td style="font-weight:500;">${escHtml(o.carrierName)}</td>
      <td style="color:var(--gold-light); font-family:'DM Mono',monospace; font-weight:500;">${escHtml(o.rate)}</td>
      <td style="color:var(--text-2);">${escHtml(o.notes || '—')}</td>
      <td style="color:var(--text-3); font-size:12px;">${timeAgo(o.ts)}</td>
      <td><button onclick="deleteOffer('${o.id}')" style="background:none; border:none; color:var(--text-3); cursor:pointer; padding:4px 8px; font-size:12px;" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--text-3)'">Remove</button></td>
    </tr>`).join('');
}

function parseDollar(str) {
  return parseFloat(String(str).replace(/[^0-9.]/g, ''));
}

function openAddOffer() {
  document.getElementById('offerCarrierName').value = '';
  document.getElementById('offerRate').value = '';
  document.getElementById('offerNotes').value = '';
  document.getElementById('addOfferModal').style.display = 'flex';
  setTimeout(() => document.getElementById('offerCarrierName').focus(), 50);
}

function closeAddOfferModal(event) {
  if (event.target === document.getElementById('addOfferModal')) {
    document.getElementById('addOfferModal').style.display = 'none';
  }
}

function submitOffer() {
  const carrierName = document.getElementById('offerCarrierName').value.trim();
  const rate = document.getElementById('offerRate').value.trim();
  if (!carrierName || !rate) { alert('Enter carrier name and rate.'); return; }

  offers.push({
    id: genId(),
    carrierName,
    rate,
    notes: document.getElementById('offerNotes').value.trim(),
    ts: Date.now()
  });

  saveOffers();
  document.getElementById('addOfferModal').style.display = 'none';
  renderOffers();
  syncOfferLane();
}

// ─── Preview ──────────────────────────────────────────────────────────────────
function previewEmail() {
  const list = activeListId ? carrierLibrary.find(l => l.id === activeListId) : null;
  const sample = list && list.carriers.length > 0
    ? list.carriers[0]
    : { name: 'Sample Carrier', email: 'carrier@example.com' };

  document.getElementById('previewTo').textContent = sample.email;
  document.getElementById('previewSubject').textContent = getFilledSubject();
  document.getElementById('previewBody').textContent = getFilledBody(sample.name);
  document.getElementById('previewModal').style.display = 'flex';
}

function deleteOffer(id) {
  offers = offers.filter(o => o.id !== id);
  saveOffers();
  renderOffers();
}

function closePreview(event) {
  if (event.target === document.getElementById('previewModal')) {
    document.getElementById('previewModal').style.display = 'none';
  }
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    document.getElementById('previewModal').style.display = 'none';
    document.getElementById('saveListModal').style.display = 'none';
    document.getElementById('addOfferModal').style.display = 'none';
  }
});

// ─── Send ─────────────────────────────────────────────────────────────────────
async function sendEmails() {
  hideBanners();

  const list = activeListId ? carrierLibrary.find(l => l.id === activeListId) : null;
  if (!list || list.carriers.length === 0) {
    document.getElementById('errorBanner').style.display = 'block';
    return;
  }

  const total = list.carriers.length;
  const isReal = !!outlookToken;

  document.getElementById('progressSection').style.display = 'block';

  if (isReal) {
    // Real sends via Microsoft Graph
    let sent = 0;
    for (const carrier of list.carriers) {
      if (carrier.status === 'sent') continue;
      const body = getFilledBody(carrier.name);
      const subject = getFilledSubject();
      const ok = await sendEmailViaGraph(carrier.email, subject, body);
      if (ok) {
        carrier.status = 'sent';
        sent++;
      }
      const pct = Math.round((sent / total) * 100);
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressPct').textContent = pct + '%';
      document.getElementById('progressLabel').textContent = 'Sent ' + sent.toLocaleString() + ' of ' + total.toLocaleString() + '...';
    }
    document.getElementById('progressLabel').textContent = 'Done — ' + sent.toLocaleString() + ' emails sent via Outlook';
    document.getElementById('sentBanner').style.display = 'block';
    document.getElementById('statSent').textContent = sent.toLocaleString();
    list.lastSentAt = Date.now();
    saveLibrary();
    renderLibraryGrid();
  } else {
    // Simulation mode
    let i = 0;
    const step = Math.max(1, Math.ceil(total / 40));
    const interval = setInterval(() => {
      i = Math.min(i + step, total);
      const pct = Math.round((i / total) * 100);
      document.getElementById('progressFill').style.width = pct + '%';
      document.getElementById('progressPct').textContent = pct + '%';
      document.getElementById('progressLabel').textContent = 'Queued ' + i.toLocaleString() + ' of ' + total.toLocaleString() + ' emails...';
      list.carriers.slice(0, i).forEach(c => { if (c.status === 'pending') c.status = 'sent'; });
      if (i >= total) {
        clearInterval(interval);
        document.getElementById('progressLabel').textContent = 'Simulated — connect Outlook to send for real';
        document.getElementById('sentBanner').style.display = 'block';
        document.getElementById('statSent').textContent = total.toLocaleString();
        list.lastSentAt = Date.now();
        saveLibrary();
        renderLibraryGrid();
      }
    }, 60);
  }
}

function hideBanners() {
  document.getElementById('sentBanner').style.display = 'none';
  document.getElementById('errorBanner').style.display = 'none';
}

// ─── AI Reply Generator ───────────────────────────────────────────────────────
async function generateReply() {
  const carrierMsg = document.getElementById('carrierReplyInput').value.trim();
  if (!carrierMsg) { alert('Paste in what the carrier said first.'); return; }

  const target = document.getElementById('negoTarget').value.trim();
  const max = document.getElementById('negoMax').value.trim();
  const style = document.getElementById('negoStyle').value;
  const context = document.getElementById('negoContext').value.trim();
  const contactName = document.getElementById('contactName').value.trim() || 'Alex';

  const pickup = document.getElementById('pickupCity').value.trim();
  const delivery = document.getElementById('deliveryCity').value.trim();
  const equip = document.getElementById('equipField').value;
  const distance = document.getElementById('distanceField').value.trim();
  const loadCount = document.getElementById('loadCount').value.trim();
  const commodity = document.getElementById('commodity').value.trim();
  const rateLow = document.getElementById('rateLow').value.trim();
  const rateHigh = document.getElementById('rateHigh').value.trim();

  const styleGuide = {
    firm: 'Hold close to the target rate. Be polite but don\'t move much. Make one small concession at most.',
    flexible: 'Be willing to negotiate. You can move toward the midpoint between target and walk-away if needed to get it covered.',
    cover: 'Getting the load covered is the priority. Be willing to meet the carrier partway if they\'re close to the walk-away rate.'
  }[style];

  const laneInfo = [
    pickup && delivery ? `Lane: ${pickup} to ${delivery}` : '',
    equip ? `Equipment: ${equip}` : '',
    distance ? `Distance: ${distance} miles` : '',
    loadCount ? `Loads: ${loadCount}` : '',
    commodity ? `Commodity: ${commodity}` : '',
    rateLow && rateHigh ? `Asking rate range: ${rateLow}–${rateHigh}` : rateLow ? `Asking rate: ${rateLow}` : '',
    target ? `Target rate (ideal): ${target}` : '',
    max ? `Walk-away rate (max we'll pay): ${max}` : '',
    context ? `Additional context: ${context}` : ''
  ].filter(Boolean).join('\n');

  const prompt = `You are a freight broker named ${contactName} at CargoVolt, a flatbed and step deck brokerage based in Atlanta. You're replying to a carrier who responded to your outreach email.

LOAD DETAILS:
${laneInfo || 'No lane details provided.'}

NEGOTIATION STYLE: ${styleGuide}

CARRIER'S REPLY:
"${carrierMsg}"

Write a short reply using Chris Voss "Never Split the Difference" negotiation tactics. Follow this exact structure:

1. ACCUSATION AUDIT first — acknowledge their number briefly. Example: "I know $650 is where you need to be..."
2. USE "ARE YOU AGAINST" — this is required every time when countering. Example: "Are you against doing this at $550?" or "Are you against working with us at $575?"
3. ONE reason why your number makes sense for them (quick turn, short miles, easy freight, more loads coming, etc.)
4. Optional calibrated question to close: "What would it take to make this work?" or "How do we get this done?"

TONE: Calm, warm, never desperate. Late-night FM DJ energy.

NEVER say "I understand" or "I appreciate" — show empathy by referencing their specific situation.
NEVER do a straight counter without the "Are you against" framing.

IF carrier is at or below target: skip negotiation entirely. Confirm enthusiastically and nail down their availability.
IF carrier is above walk-away: say "I can't make that work at [their number]" and hold firm. Don't offer more.
IF carrier is between target and walk-away: use the full structure above.

HARD RULES:
- Never go over the walk-away rate
- No em-dashes
- 3 to 5 sentences max
- End with ${contactName} and "CargoVolt"
- No subject line, just the body`;

  const btn = document.getElementById('generateBtn');
  const status = document.getElementById('generateStatus');
  btn.disabled = true;
  status.textContent = 'Generating...';

  try {
    const response = await fetch('/.netlify/functions/negotiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const text = data.content && data.content[0] ? data.content[0].text : '';

    if (text) {
      document.getElementById('generatedReplyText').textContent = text.trim();
      document.getElementById('generatedReplyWrap').style.display = 'block';
      status.textContent = '';
    } else {
      // Show full response for debugging
      const errDetail = data.error ? `${data.error.type}: ${data.error.message}` : JSON.stringify(data).slice(0, 200);
      status.textContent = 'Error: ' + errDetail;
      document.getElementById('generatedReplyText').textContent = JSON.stringify(data, null, 2);
      document.getElementById('generatedReplyWrap').style.display = 'block';
    }
  } catch (e) {
    status.textContent = 'Network error: ' + e.message;
  } finally {
    btn.disabled = false;
  }
}

function copyReply() {
  const text = document.getElementById('generatedReplyText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const confirm = document.getElementById('copyConfirm');
    confirm.style.display = 'block';
    setTimeout(() => confirm.style.display = 'none', 2000);
  });
}


// ─── Outlook / MSAL ───────────────────────────────────────────────────────────
const MSAL_CONFIG = {
  auth: {
    clientId: '84f46c8b-29e8-400b-9f9d-ed628c9bb8e9',
    authority: 'https://login.microsoftonline.com/common',
    redirectUri: 'https://amazing-malasada-0c0935.netlify.app'
  },
  cache: { cacheLocation: 'localStorage' }
};

const GRAPH_SCOPES = ['Mail.Send', 'Mail.Read', 'User.Read'];

let msalInstance = null;
let outlookAccount = null;
let outlookToken = null;

function initMsal() {
  if (typeof msal === 'undefined') return;
  msalInstance = new msal.PublicClientApplication(MSAL_CONFIG);
  msalInstance.initialize().then(() => {
    const accounts = msalInstance.getAllAccounts();
    if (accounts.length > 0) {
      outlookAccount = accounts[0];
      setOutlookConnected(outlookAccount.username);
      acquireToken();
    }
  });
}

async function connectOutlook() {
  if (!msalInstance) { alert('Authentication library not loaded. Try refreshing the page.'); return; }
  try {
    const result = await msalInstance.loginPopup({ scopes: GRAPH_SCOPES });
    outlookAccount = result.account;
    outlookToken = result.accessToken;
    setOutlookConnected(outlookAccount.username);
    alert('Outlook connected as ' + outlookAccount.username);
  } catch (e) {
    if (e.errorCode !== 'user_cancelled') {
      alert('Sign-in failed: ' + e.message);
    }
  }
}

async function acquireToken() {
  if (!msalInstance || !outlookAccount) return null;
  try {
    const result = await msalInstance.acquireTokenSilent({ scopes: GRAPH_SCOPES, account: outlookAccount });
    outlookToken = result.accessToken;
    return outlookToken;
  } catch (e) {
    try {
      const result = await msalInstance.acquireTokenPopup({ scopes: GRAPH_SCOPES, account: outlookAccount });
      outlookToken = result.accessToken;
      return outlookToken;
    } catch (e2) {
      return null;
    }
  }
}

function setOutlookConnected(email) {
  document.getElementById('outlookStatus').innerHTML =
    '<div class="status-dot connected"></div><span>' + email + '</span>';
  document.getElementById('connectBtn').textContent = 'Disconnect';
  document.getElementById('connectBtn').onclick = disconnectOutlook;
}

function disconnectOutlook() {
  if (msalInstance && outlookAccount) {
    msalInstance.logoutPopup({ account: outlookAccount });
  }
  outlookAccount = null;
  outlookToken = null;
  document.getElementById('outlookStatus').innerHTML =
    '<div class="status-dot disconnected"></div><span>Outlook disconnected</span>';
  document.getElementById('connectBtn').textContent = 'Connect Outlook';
  document.getElementById('connectBtn').onclick = connectOutlook;
}

async function sendEmailViaGraph(toEmail, subject, body) {
  const token = await acquireToken();
  if (!token) { alert('Not connected to Outlook. Please connect first.'); return false; }

  const ccEmail = localStorage.getItem('cv_cc_email') || '';

  const message = {
    message: {
      subject,
      body: { contentType: 'Text', content: body },
      toRecipients: [{ emailAddress: { address: toEmail } }],
      ccRecipients: ccEmail ? [{ emailAddress: { address: ccEmail } }] : []
    },
    saveToSentItems: true
  };

  const res = await fetch('https://graph.microsoft.com/v1.0/me/sendMail', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(message)
  });

  return res.status === 202;
}

// ─── Settings ─────────────────────────────────────────────────────────────────
function saveSettings() {
  const name = document.getElementById('contactName').value.trim();
  const email = document.getElementById('replyEmail').value.trim();
  if (!name && !email) { alert('Enter your name and email address first.'); return; }

  localStorage.setItem('cv_contact_name', name);
  localStorage.setItem('cv_reply_email', email);
  localStorage.setItem('cv_cc_email', document.getElementById('ccEmail').value.trim());
  localStorage.setItem('cv_auto_reply', document.getElementById('autoToggle').classList.contains('on') ? '1' : '0');
  localStorage.setItem('cv_flag_replies', document.getElementById('flagToggle').classList.contains('on') ? '1' : '0');
  localStorage.setItem('cv_digest', document.getElementById('digestToggle').classList.contains('on') ? '1' : '0');
  localStorage.setItem('cv_nego_target', document.getElementById('negoTarget').value.trim());
  localStorage.setItem('cv_nego_max', document.getElementById('negoMax').value.trim());
  localStorage.setItem('cv_nego_style', document.getElementById('negoStyle').value);
  localStorage.setItem('cv_nego_context', document.getElementById('negoContext').value.trim());
  alert('Settings saved.');
}

function loadSettings() {
  const name = localStorage.getItem('cv_contact_name');
  const email = localStorage.getItem('cv_reply_email');
  if (name) document.getElementById('contactName').value = name;
  if (email) document.getElementById('replyEmail').value = email;
  const ccEmail = localStorage.getItem('cv_cc_email');
  if (ccEmail) document.getElementById('ccEmail').value = ccEmail;

  const negoTarget = localStorage.getItem('cv_nego_target');
  const negoMax = localStorage.getItem('cv_nego_max');
  const negoStyle = localStorage.getItem('cv_nego_style');
  const negoContext = localStorage.getItem('cv_nego_context');
  if (negoTarget) document.getElementById('negoTarget').value = negoTarget;
  if (negoMax) document.getElementById('negoMax').value = negoMax;
  if (negoStyle) document.getElementById('negoStyle').value = negoStyle;
  if (negoContext) document.getElementById('negoContext').value = negoContext;

  setToggle('autoToggle', localStorage.getItem('cv_auto_reply') !== '0');
  setToggle('flagToggle', localStorage.getItem('cv_flag_replies') !== '0');
  setToggle('digestToggle', localStorage.getItem('cv_digest') === '1');
}

function setToggle(id, on) {
  const el = document.getElementById(id);
  el.classList.toggle('on', on);
  el.classList.toggle('off', !on);
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function escHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 2) return 'just now';
  if (mins < 60) return mins + 'm ago';
  if (hrs < 24) return hrs + 'h ago';
  if (days < 7) return days + 'd ago';
  return new Date(ts).toLocaleDateString();
}

// ─── Start ────────────────────────────────────────────────────────────────────
boot();
