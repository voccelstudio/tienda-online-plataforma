const API = {
  async raw(method, url, body) {
    const r = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
    const ct = (r.headers.get('content-type') || '').toLowerCase();
    if (ct.includes('json')) return { status: r.status, data: await r.json() };
    throw new Error('NOT_JSON');
  },

  async request(method, url, body) {
    try {
      const { status, data } = await API.raw(method, url, body);
      if (status < 200 || status >= 300) throw new Error(data.error || 'Error de servidor');
      return data;
    } catch (e) {
      // Sin backend (GitHub Pages o servidor apagado) -> usar base local del navegador
      if (e.message === 'NOT_JSON' || e instanceof TypeError || /fail|network|fetch|load/i.test(e.message)) {
        if (typeof LocalDB !== 'undefined') return LocalDB.handle(method, url, body);
      }
      throw e;
    }
  },

  get(url) { return API.request('GET', url); },
  post(url, body) { return API.request('POST', url, body); },
  put(url, body) { return API.request('PUT', url, body); },
  del(url) { return API.request('DELETE', url); }
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