const API = {
  async get(url) {
    const r = await fetch(url);
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Error de servidor');
    return j;
  },
  async post(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Error de servidor');
    return j;
  },
  async put(url, body) {
    const r = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Error de servidor');
    return j;
  },
  async del(url) {
    const r = await fetch(url, { method: 'DELETE' });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || 'Error de servidor');
    return j;
  }
};

const fmt = new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'USD' });
function money(n) { return fmt.format(Number(n || 0)); }

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function imgFallback(src) {
  return `<img src="${esc(src)}" alt="" onerror="this.parentElement.innerHTML='<span style=&quot;font-size:4.2rem&quot;>👕</span>'">`;
}

function thumb(src) {
  if (src) return `<span class="thumb-sm">${imgFallback(src)}</span>`;
  return `<span class="thumb-sm">👕</span>`;
}

function toast(msg, type = 'ok') {
  const wrap = document.getElementById('toasts');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<i class="fa-solid ${type === 'err' ? 'fa-circle-xmark' : type === 'warn' ? 'fa-triangle-exclamation' : 'fa-circle-check'}"></i><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = '.3s'; }, 3400);
  setTimeout(() => el.remove(), 3800);
}

function totalStock(sizes) {
  return (sizes || []).reduce((a, s) => a + s.stock, 0);
}

function lowestStock(sizes) {
  return (sizes || []).reduce((a, s) => Math.min(a, s.stock), Infinity);
}