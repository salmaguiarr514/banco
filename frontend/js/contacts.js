// â”€â”€ Mapa de bancos â”€â”€
let banksMap = new Map();
const loadBanks = async () => {
  try {
    const banks = await apiFetch('/transferencias/central/bancos');
    if (Array.isArray(banks)) banks.forEach(b => banksMap.set(String(b.bankCode), b.name));
  } catch {}
};
const getBankName = (bankCode) => bankCode ? (banksMap.get(String(bankCode)) || `Banco ${bankCode}`) : null;

// â”€â”€ Favoritos & Recientes â”€â”€
const FAV_KEY = 'nodo_favoritos';
const REC_KEY = 'nodo_recientes';
const getFavoritos = () => JSON.parse(localStorage.getItem(FAV_KEY) || '[]');
const getRecientes = () => JSON.parse(localStorage.getItem(REC_KEY) || '[]');
const saveFavoritos = (list) => localStorage.setItem(FAV_KEY, JSON.stringify(list));
const saveRecientes = (list) => localStorage.setItem(REC_KEY, JSON.stringify(list));

const AVATAR_COLORS = ['#10B981','#3B82F6','#8B5CF6','#EC4899','#F59E0B','#0EA5E9','#EF4444'];
const getAvatarColor = (nombre) => {
  let sum = 0;
  for (const c of (nombre || '')) sum += c.charCodeAt(0);
  return AVATAR_COLORS[sum % AVATAR_COLORS.length];
};
const getInitials = (nombre, apellido) =>
  ((nombre || '')[0] || '').toUpperCase() + ((apellido || '')[0] || '').toUpperCase() || '?';

const SUGERIDOS = [
  { nombre: 'Lucas',     apellido: 'PÃ©rez',    alias: 'lucas.perez.nodo' },
  { nombre: 'Valentina', apellido: 'GarcÃ­a',   alias: 'valentina.garcia.nodo' },
  { nombre: 'Mateo',     apellido: 'LÃ³pez',    alias: 'mateo.lopez.nodo' },
  { nombre: 'SofÃ­a',     apellido: 'MartÃ­nez', alias: 'sofia.martinez.nodo' },
];

function renderContactCard(persona, isStarred) {
  const ini   = getInitials(persona.nombre, persona.apellido);
  const color = getAvatarColor(persona.nombre);
  const label = `${persona.nombre || ''} ${((persona.apellido || '')[0] || '')}.`.trim();
  const starClass = isStarred ? 'contact-star starred' : 'contact-star';
  return `
    <div class="contact-card"
      data-nombre="${persona.nombre || ''}"
      data-apellido="${persona.apellido || ''}"
      data-cbu="${persona.cbu || ''}"
      data-alias="${persona.alias || ''}"
      data-banco="${persona.bankName || 'Nodo'}">
      <div class="contact-avatar" style="background:${color}">${ini}</div>
      <span class="contact-name">${label}</span>
      <button class="${starClass}"
        data-nombre="${persona.nombre || ''}"
        data-apellido="${persona.apellido || ''}"
        data-cbu="${persona.cbu || ''}"
        data-alias="${persona.alias || ''}">
        <i class="fas fa-star"></i>
      </button>
    </div>`;
}

function renderContacts() {
  const favs = getFavoritos();
  const recs = getRecientes();
  const favKeys = new Set(favs.map(f => f.cbu || f.alias));

  const sections = [
    { listId: 'favoritosList', sectionId: 'favoritosSection', items: favs, starred: () => true },
    { listId: 'recientesList', sectionId: 'recientesSection', items: recs.slice(0,6), starred: p => favKeys.has(p.cbu || p.alias) },
    { listId: 'sugeridosList', sectionId: 'sugeridosSection',
      items: SUGERIDOS.filter(s => !favKeys.has(s.alias) && !recs.some(r => r.alias === s.alias)),
      starred: () => false },
  ];

  sections.forEach(({ listId, sectionId, items, starred }) => {
    const list = document.getElementById(listId);
    const sec  = document.getElementById(sectionId);
    if (!list || !sec) return;
    if (items.length === 0) { sec.classList.add('hidden'); return; }
    sec.classList.remove('hidden');
    list.innerHTML = items.map(p => renderContactCard(p, starred(p))).join('');
  });

  document.querySelectorAll('.contact-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.contact-star')) return;
      selectRecipient({
        nombre:   card.dataset.nombre,
        apellido: card.dataset.apellido,
        cbu:      card.dataset.cbu,
        alias:    card.dataset.alias,
        bankName: card.dataset.banco,
      });
    });
  });

  document.querySelectorAll('.contact-star').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      toggleFavorito({ nombre: btn.dataset.nombre, apellido: btn.dataset.apellido, cbu: btn.dataset.cbu, alias: btn.dataset.alias });
      renderContacts();
    });
  });
}

function selectRecipient(persona) {
  destinatarioValidado  = persona;
  cbuDestinoVerificado  = persona.cbu || '';
  const cbuInput = document.getElementById('cbuDestino');
  if (cbuInput) cbuInput.value = persona.alias || persona.cbu || '';

  const preview = document.getElementById('recipientPreview');
  if (preview) {
    const ini   = getInitials(persona.nombre, persona.apellido);
    const color = getAvatarColor(persona.nombre);
    const bankLabel = persona.bankName || getBankName(persona.bankCode) || 'Nodo';
    preview.innerHTML = `
      <div class="contact-avatar" style="background:${color};width:44px;height:44px;font-size:0.95rem;">${ini}</div>
      <div class="recipient-info">
        <b>${persona.nombre || ''} ${persona.apellido || ''}</b>
        <span>${persona.alias || persona.cbu || ''}</span>
        <span class="recipient-bank"><i class="fas fa-university"></i> ${bankLabel}</span>
      </div>`;
  }

  document.getElementById('transferStep1')?.classList.add('hidden');
  document.getElementById('transferStep2')?.classList.remove('hidden');
  setTimeout(() => document.getElementById('monto')?.focus(), 80);
}

function toggleFavorito(persona) {
  let favs = getFavoritos();
  const key = persona.cbu || persona.alias;
  const idx = favs.findIndex(f => (f.cbu || f.alias) === key);
  if (idx >= 0) favs.splice(idx, 1);
  else { favs.unshift({ ...persona }); if (favs.length > 12) favs.length = 12; }
  saveFavoritos(favs);
}

function addReciente(persona) {
  if (!persona?.nombre) return;
  let recs = getRecientes().filter(r => (r.cbu || r.alias) !== (persona.cbu || persona.alias));
  recs.unshift({ ...persona, fecha: new Date().toISOString() });
  if (recs.length > 8) recs.length = 8;
  saveRecientes(recs);
}

