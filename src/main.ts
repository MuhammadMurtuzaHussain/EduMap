import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { Resource } from '../shared/types.ts';
import { addResource, askQuestion, getMeta, getResources, type Meta } from './api.ts';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const label = (s: string) => s.replace('-', ' ');

const map = L.map('map').setView([53.4808, -2.2426], 13);
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
}).addTo(map);
const layer = L.layerGroup().addTo(map);
const markers = new Map<number, L.CircleMarker>();
let shown: Resource[] = [];
let pin: L.Marker | null = null;
let meta: Meta;

function card(r: Resource): string {
  const site = r.website ? ` · <a href="${esc(r.website)}" target="_blank" rel="noopener">website</a>` : '';
  return `<li class="card" data-id="${r.id}"><h3>${esc(r.name)}</h3>
    <div class="chips"><span class="chip">${esc(label(r.category))}</span><span class="chip ${r.cost === 'free' ? 'free' : ''}">${r.cost}</span>
    <span class="chip">${esc(r.audience)}</span>${r.languages.map((l) => `<span class="chip">${esc(l)}</span>`).join('')}</div>
    <p>${esc(r.description)}</p><p class="muted">${esc(r.address)}${r.hours ? ' · ' + esc(r.hours) : ''}${site}</p></li>`;
}

function render(list: Resource[]) {
  shown = list;
  $('count').textContent = `${list.length} of ${meta.total} resources`;
  $('list').innerHTML = list.map(card).join('') || '<li class="muted">No matches. Try loosening the filters.</li>';
  layer.clearLayers();
  markers.clear();
  for (const r of list) {
    const m = L.circleMarker([r.lat, r.lng], { radius: 8, weight: 2, color: '#0f6b5c', fillColor: r.cost === 'free' ? '#4cc3a8' : '#e0a458', fillOpacity: 0.9 })
      .bindPopup(`<strong>${esc(r.name)}</strong><br>${esc(label(r.category))} · ${r.cost}`)
      .addTo(layer);
    m.on('click', () => highlight(r.id, false));
    markers.set(r.id, m);
  }
  if (list.length) map.fitBounds(L.latLngBounds(list.map((r) => [r.lat, r.lng] as [number, number])).pad(0.2), { maxZoom: 15 });
}

function highlight(id: number, pan: boolean) {
  document.querySelectorAll('.card.active').forEach((e) => e.classList.remove('active'));
  const el = document.querySelector(`.card[data-id="${id}"]`);
  el?.classList.add('active');
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  const m = markers.get(id);
  if (m && pan) { map.panTo(m.getLatLng()); m.openPopup(); }
}

const val = (id: string) => (document.getElementById(id) as HTMLInputElement).value;
async function load() {
  render(await getResources({
    q: val('f-q') || undefined, category: val('f-category') || undefined, cost: (val('f-cost') || undefined) as Resource['cost'] | undefined,
    audience: (val('f-audience') || undefined) as Resource['audience'] | undefined, language: val('f-language') || undefined,
  }));
}

function fill(id: string, values: readonly string[], anyOption: boolean) {
  $<HTMLSelectElement>(id).innerHTML = (anyOption ? '<option value="">Any</option>' : '') + values.map((v) => `<option value="${esc(v)}">${esc(label(v))}</option>`).join('');
}

async function init() {
  meta = await getMeta();
  fill('f-category', meta.categories, true); fill('f-cost', meta.costs, true);
  fill('f-audience', meta.audiences, true); fill('f-language', meta.languages, true);
  fill('a-category', meta.categories, false); fill('a-cost', meta.costs, false); fill('a-audience', meta.audiences, false);
  const badge = $('badge');
  badge.hidden = false;
  badge.textContent = meta.ai.available ? `AI: ${meta.ai.model} (local)` : meta.static ? 'Static demo: keyword search' : 'AI off: search only';
  badge.classList.toggle('on', meta.ai.available);
  $('notice').hidden = false;
  $('notice').textContent = 'Demo data: every resource shown is fictional, placed around an arbitrary map centre. Replace it with real local data to use EduMap.';
  $('askNote').textContent = meta.ai.available ? 'Answered by an open-weight Gemma model running locally.'
    : meta.static ? 'This hosted demo uses keyword matching. Run EduMap locally with Ollama to get Gemma.' : 'No local model detected, so questions use simple keyword matching.';
  if (meta.readOnly) $('addBox').hidden = true;
  await load();
}

for (const id of ['f-q', 'f-category', 'f-cost', 'f-audience', 'f-language']) $(id).addEventListener('input', () => void load());
$('reset').addEventListener('click', () => {
  for (const id of ['f-q', 'f-category', 'f-cost', 'f-audience', 'f-language']) (document.getElementById(id) as HTMLInputElement).value = '';
  $('picks').innerHTML = '';
  void load();
});
$('list').addEventListener('click', (e) => {
  const id = Number((e.target as HTMLElement).closest('.card')?.getAttribute('data-id'));
  if (id) highlight(id, true);
});

$('ask').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = $<HTMLInputElement>('q').value.trim();
  if (q.length < 3) return;
  const btn = $<HTMLButtonElement>('askBtn');
  btn.disabled = true; btn.textContent = 'Thinking…';
  try {
    const out = await askQuestion(q);
    render(out.results);
    const names = new Map(out.results.map((r) => [r.id, r.name]));
    $('picks').innerHTML = out.picks.map((p) => `<li class="why" data-id="${p.id}"><strong>${esc(names.get(p.id) ?? '')}</strong>: ${esc(p.why)}</li>`).join('');
    $('askNote').textContent = out.mode === 'gemma' ? `Gemma (${out.model}) picked these filters: ${Object.entries(out.filters).map(([k, v]) => `${k}=${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ') || 'none'}` : 'Model unavailable; used keyword matching.';
  } finally {
    btn.disabled = false; btn.textContent = 'Ask';
  }
});
$('picks').addEventListener('click', (e) => {
  const id = Number((e.target as HTMLElement).closest('.why')?.getAttribute('data-id'));
  if (id) highlight(id, true);
});

map.on('click', (e) => {
  if (meta?.readOnly || !$<HTMLDetailsElement>('addBox').open) return;
  if (pin) pin.setLatLng(e.latlng); else pin = L.marker(e.latlng).addTo(map);
  $('pinNote').textContent = `Pin at ${e.latlng.lat.toFixed(5)}, ${e.latlng.lng.toFixed(5)}`;
});

$('add').addEventListener('submit', async (e) => {
  e.preventDefault();
  const msg = $('addMsg');
  if (!pin) { msg.textContent = 'Click the map to place the pin first.'; return; }
  const fd = new FormData(e.target as HTMLFormElement);
  const body = {
    ...Object.fromEntries(fd), languages: String(fd.get('languages') ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    lat: pin.getLatLng().lat, lng: pin.getLatLng().lng,
  };
  const out = await addResource(body as never);
  if (!out.ok) { msg.textContent = out.error ?? 'Could not save.'; return; }
  msg.textContent = 'Saved.';
  (e.target as HTMLFormElement).reset();
  pin.remove(); pin = null;
  await init();
});

void init();
