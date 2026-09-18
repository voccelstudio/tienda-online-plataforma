const Store = {
  products: [],
  categories: [],
  sizes: [],
  filterCat: 'todas',
  filterSize: 'todas',
  search: '',
  sort: 'nuevos',
  cart: [],
  settings: null,
  _coupon: null,
  selectedSize: null,
  qty: 1,
  currentProduct: null,
  slideIdx: 0,
  _hsT: null,

  async load() {
    this.products = await API.get('/api/products');
    const cats = [...new Set(this.products.map(p => p.category))];
    cats.sort((a, b) => a.localeCompare(b));
    this.categories = cats;
    const sizes = [...new Set(this.products.flatMap(p => (p.sizes || []).map(s => s.size)))];
    sizes.sort((a, b) => ({ S: 1, M: 2, L: 3, XL: 4 }[a] || 9) - ({ S: 1, M: 2, L: 3, XL: 4 }[b] || 9));
    this.sizes = sizes;
    this.loadCart();
    try { this.settings = await API.get('/api/settings'); } catch (e) { this.settings = null; }
  },

  render() {
    const app = document.getElementById('app');
    const filtered = this.filteredProducts();
    const slides = (this.settings && this.settings.hero_slides && this.settings.hero_slides.length) ? this.settings.hero_slides : null;

    app.innerHTML = `
      ${slides ? this.heroSliderHTML(slides) : this.heroDefaultHTML()}
      <div class="container">
        <div class="toolbar">
          <div class="search-box grow">
            <i class="fa-solid fa-magnifying-glass"></i>
            <input type="search" id="storeSearch" placeholder="Buscar prendas..." value="${esc(this.search)}">
          </div>
          <div class="chips" id="catChips">
            <button class="chip ${this.filterCat === 'todas' ? 'active' : ''}" data-cat="todas">Todas</button>
            ${this.categories.map(c => `<button class="chip ${this.filterCat === c ? 'active' : ''}" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
          </div>
          <div class="chips" id="sizeChips">
            <button class="chip ${this.filterSize === 'todas' ? 'active' : ''}" data-size="todas">Todas las tallas</button>
            ${this.sizes.map(sz => `<button class="chip ${this.filterSize === sz ? 'active' : ''}" data-size="${esc(sz)}">Talla ${esc(sz)}</button>`).join('')}
          </div>
          <select class="select" id="storeSort">
            <option value="nuevos" ${this.sort === 'nuevos' ? 'selected' : ''}>Más nuevos</option>
            <option value="precio-asc" ${this.sort === 'precio-asc' ? 'selected' : ''}>Precio: menor a mayor</option>
            <option value="precio-desc" ${this.sort === 'precio-desc' ? 'selected' : ''}>Precio: mayor a menor</option>
            <option value="stock" ${this.sort === 'stock' ? 'selected' : ''}>Con más stock</option>
          </select>
        </div>
        <div style="display:flex;gap:10px;margin:14px 0;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" id="sizeGuide"><i class="fa-solid fa-ruler"></i> Guía de talles</button>
          <button class="btn btn-outline btn-sm" id="trackOrder"><i class="fa-solid fa-magnifying-glass-location"></i> Consultar mi pedido</button>
        </div>

        <div class="section-title">
          <h2>${this.filterCat === 'todas' ? 'Todas las prendas' : esc(this.filterCat)}</h2>
          <span class="muted">${filtered.length} productos</span>
        </div>

        ${filtered.length ? `
          <div class="grid">
            ${filtered.map(p => this.cardHTML(p)).join('')}
          </div>
        ` : `
          <div class="cart-empty" style="padding:60px 0">
            <i class="fa-solid fa-shirt"></i>
            <p>No encontramos prendas con esos filtros.</p>
          </div>
        `}
      </div>
    `;

    app.querySelector('#storeSearch').addEventListener('input', e => { this.search = e.target.value; this.render(); });
    app.querySelector('#storeSort').addEventListener('change', e => { this.sort = e.target.value; this.render(); });
    app.querySelectorAll('#catChips .chip').forEach(chip => {
      chip.addEventListener('click', () => { this.filterCat = chip.dataset.cat; this.render(); });
    });
    app.querySelectorAll('#sizeChips .chip').forEach(chip => {
      chip.addEventListener('click', () => { this.filterSize = chip.dataset.size; this.render(); });
    });
    app.querySelector('#sizeGuide').addEventListener('click', () => this.showSizeGuide());
    app.querySelector('#trackOrder').addEventListener('click', () => this.showTrackModal());
    app.querySelectorAll('[data-open-product]').forEach(el => {
      el.addEventListener('click', () => this.openProduct(Number(el.dataset.openProduct)));
    });
    if (slides) this.heroBind();
    this.updateCartUI();
  },

  heroDefaultHTML() {
    return `
      <section class="hero">
        <div class="hero-inner">
          <div>
            <h1>Moda urbana con <em>inventario en tiempo real</em></h1>
            <p>Elige tu talla, agrega al carrito y finaliza tu compra. El stock se descuenta automáticamente al confirmar el pedido.</p>
            <div class="hero-badges">
              <div class="hero-badge"><i class="fa-solid fa-truck-fast"></i> Envío y retiro en tienda</div>
              <div class="hero-badge"><i class="fa-solid fa-arrows-rotate"></i> Devoluciones fáciles</div>
              <div class="hero-badge today"><i class="fa-solid fa-boxes-stacked"></i> Stock sincronizado</div>
            </div>
          </div>
          <div class="hero-art">🛍️</div>
        </div>
      </section>
    `;
  },

  heroSliderHTML(slides) {
    const total = slides.length;
    return `
      <section class="hero hero-slider" id="heroSlider">
        <div class="hero-track">
          ${slides.map((s, i) => `
            <div class="hero-slide ${i === (this.slideIdx % total) ? 'active' : ''}" style="background-image:url('${esc(s.image)}')">
              <div class="hero-inner hero-slide-inner">
                <div class="hero-slide-content">
                  ${s.tag ? `<span class="hero-tag">${esc(s.tag)}</span>` : ''}
                  ${s.title ? `<h1>${esc(s.title)}</h1>` : ''}
                  ${s.subtitle ? `<p>${esc(s.subtitle)}</p>` : ''}
                  ${s.link ? `<a class="hero-cta" href="${esc(s.link)}" target="_blank" rel="noopener">Ver más <i class="fa-solid fa-arrow-right"></i></a>` : `<button class="hero-cta" data-open-drawer>Explorar la tienda <i class="fa-solid fa-arrow-right"></i></button>`}
                </div>
              </div>
            </div>`).join('')}
        </div>
        ${total > 1 ? `
          <button class="hero-arrow left" data-hero-prev><i class="fa-solid fa-chevron-left"></i></button>
          <button class="hero-arrow right" data-hero-next><i class="fa-solid fa-chevron-right"></i></button>
          <div class="hero-dots">${slides.map((s, i) => `<button class="hero-dot ${i === (this.slideIdx % total) ? 'active' : ''}" data-dot="${i}"></button>`).join('')}</div>
          <div class="hero-count">${(this.slideIdx % total) + 1} / ${total}</div>` : ''}
      </section>
    `;
  },

  heroBind() {
    const slider = document.getElementById('heroSlider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.hero-slide');
    const total = slides.length;
    if (!total) return;
    let idx = ((this.slideIdx || 0) % total + total) % total;
    const go = i => {
      idx = ((i % total) + total) % total;
      this.slideIdx = idx;
      slides.forEach((s, k) => s.classList.toggle('active', k === idx));
      slider.querySelectorAll('.hero-dot').forEach((d, k) => d.classList.toggle('active', k === idx));
      const c = slider.querySelector('.hero-count');
      if (c) c.textContent = (idx + 1) + ' / ' + total;
    };
    const next = () => go(idx + 1);
    const restart = () => {
      if (this._hsT) clearInterval(this._hsT);
      if (total > 1) this._hsT = setInterval(next, 5000);
    };
    slider.querySelectorAll('[data-hero-next]').forEach(b => b.addEventListener('click', () => { go(idx + 1); restart(); }));
    slider.querySelectorAll('[data-hero-prev]').forEach(b => b.addEventListener('click', () => { go(idx - 1); restart(); }));
    slider.querySelectorAll('.hero-dot').forEach(d => d.addEventListener('click', () => { go(Number(d.dataset.dot)); restart(); }));
    slider.querySelectorAll('[data-open-drawer]').forEach(b => b.addEventListener('click', () => this.openCart()));
    if (this._hsT) clearInterval(this._hsT);
    if (total > 1) this._hsT = setInterval(next, 5000);
    slider.addEventListener('mouseenter', () => { if (this._hsT) clearInterval(this._hsT); });
    slider.addEventListener('mouseleave', () => { if (total > 1) this._hsT = setInterval(next, 5000); });
  },

  persistCart() {
    try { localStorage.setItem('voccela.cart', JSON.stringify(this.cart)); } catch (e) {}
  },
  loadCart() {
    try {
      const raw = localStorage.getItem('voccela.cart');
      if (raw) this.cart = JSON.parse(raw) || [];
    } catch (e) { this.cart = []; }
  },
  clearCart() { this.cart = []; this.persistCart(); },

  filteredProducts() {
    let list = [...this.products];
    if (this.filterCat !== 'todas') list = list.filter(p => p.category === this.filterCat);
    if (this.filterSize !== 'todas') list = list.filter(p => (p.sizes || []).some(s => s.size === this.filterSize && s.stock > 0));
    if (this.search) {
      const q = this.search.toLowerCase();
      list = list.filter(p => (p.name + ' ' + p.description).toLowerCase().includes(q));
    }
    switch (this.sort) {
      case 'precio-asc': list.sort((a, b) => a.price - b.price); break;
      case 'precio-desc': list.sort((a, b) => b.price - a.price); break;
      case 'stock': list.sort((a, b) => totalStock(b.sizes) - totalStock(a.sizes)); break;
      default: list.sort((a, b) => b.id - a.id);
    }
    return list;
  },

  cardHTML(p) {
    const stock = totalStock(p.sizes);
    const stocks = `${p.sizes.map(s => `${s.size}:${s.stock}`).join(', ')}`;
    let tag = '';
    if (stock === 0) tag = ' agotado';
    const disc = p.discount > 0;
    const stockLine = stock >= 8
      ? `<div class="stock-line ok"><i class="fa-solid fa-circle-check"></i> En stock · ${stocks}</div>`
      : stock > 0
        ? `<div class="stock-line low"><i class="fa-solid fa-triangle-exclamation"></i> Pocas unidades · ${stocks}</div>`
        : `<div class="stock-line none"><i class="fa-solid fa-circle-xmark"></i> Agotado</div>`;
    return `
      <div class="card" data-open-product="${p.id}">
        <div class="card-img">
          ${p.image ? imgFallback(p.image) : `<span class="ph">👕</span>`}
          ${disc ? `<span class="disc-badge">-${p.discount}%</span>` : ''}
          ${tag ? `<span class="card-tag agotado">AGOTADO</span>` : `<span class="card-tag">${esc(p.category)}</span>`}
        </div>
        <div class="card-body">
          <h3>${esc(p.name)}</h3>
          <div class="cat">${esc(p.category)}</div>
          <div class="card-price">
            <span class="price-row" style="margin-top:0">${disc ? `<span class="price-line">${money(p.list_price)}</span>` : ''}<span class="price">${money(p.price)}</span></span>
            <button class="btn btn-accent btn-sm" data-open-product="${p.id}"><i class="fa-solid fa-cart-plus"></i></button>
          </div>
          ${stockLine}
        </div>
      </div>
    `;
  },

  showSizeGuide() {
    const overlay = document.getElementById('productModal');
    const box = document.getElementById('productModalBox');
    overlay.hidden = false;
    box.hidden = false;
    box.innerHTML = `
      <div class="modal-inner">
        <div class="modal-head"><h2>Guía de talles</h2><button class="modal-close" id="pmClose"><i class="fa-solid fa-xmark"></i></button></div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Talla</th><th>Pecho (cm)</th><th>Cintura (cm)</th><th>Cadera (cm)</th></tr></thead>
            <tbody>
              <tr><td><strong>S</strong></td><td>86-94</td><td>70-78</td><td>88-96</td></tr>
              <tr><td><strong>M</strong></td><td>94-102</td><td>78-86</td><td>96-104</td></tr>
              <tr><td><strong>L</strong></td><td>102-110</td><td>86-94</td><td>104-112</td></tr>
              <tr><td><strong>XL</strong></td><td>110-120</td><td>94-104</td><td>112-122</td></tr>
            </tbody>
          </table>
        </div>
        <p class="muted" style="margin-top:12px;font-size:.85rem"><i class="fa-solid fa-circle-info"></i> Medidas aproximadas. Si estás entre tallas, te recomendamos elegir la más grande.</p>
      </div>`;
    box.querySelector('#pmClose').addEventListener('click', () => this.closeProductModal());
    overlay.addEventListener('click', () => this.closeProductModal());
  },

  async showTrackModal() {
    const overlay = document.getElementById('productModal');
    const box = document.getElementById('productModalBox');
    overlay.hidden = false;
    box.hidden = false;
    box.innerHTML = `
      <div class="modal-inner">
        <div class="modal-head"><h2>Consultar mi pedido</h2><button class="modal-close" id="pmClose"><i class="fa-solid fa-xmark"></i></button></div>
        <form id="trackForm" class="checkout-form">
          <div class="field"><label>Número de pedido *</label><input name="oid" placeholder="Ej. 12" required></div>
          <div class="field"><label>Teléfono con el que compraste *</label><input name="ophone" placeholder="+595 ..." required></div>
          <button class="btn btn-primary btn-block" type="submit"><i class="fa-solid fa-magnifying-glass-location"></i> Buscar pedido</button>
        </form>
        <div id="trackResult"></div>
      </div>`;
    box.querySelector('#pmClose').addEventListener('click', () => this.closeProductModal());
    overlay.addEventListener('click', () => this.closeProductModal());
    box.querySelector('#trackForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const out = box.querySelector('#trackResult');
      try {
        const o = await API.get('/api/orders/' + Number(f.oid.value));
        if (String(o.customer_phone || '').replace(/[^\d]/g, '') !== String(f.ophone.value).replace(/[^\d]/g, '')) {
          out.innerHTML = '<div class="muted" style="padding:16px 0">No encontramos un pedido con esos datos.</div>';
          return;
        }
        out.innerHTML = `
          <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:14px">
            <h3>Pedido #${o.id} <span class="status ${o.status}">${o.status}</span></h3>
            <div class="muted" style="margin:6px 0 10px">Registrado: ${esc(o.created_at)}</div>
            <div class="summary-row"><span>Total</span><strong>${money(o.total)}</strong></div>
            ${o.payment_status ? `<div class="summary-row"><span>Pago</span><strong>${o.payment_status === 'pagado' ? 'Pagado ✓' : 'Pendiente'}</strong></div>` : ''}
            ${o.delivery_method === 'retiro'
              ? `<p class="muted" style="margin-top:8px"><i class="fa-solid fa-shop"></i> ${esc(o.pickup_point || 'Retiro en tienda')}${o.pickup_date ? ' · ' + esc(o.pickup_date) : ''}</p>`
              : `<p class="muted" style="margin-top:8px"><i class="fa-solid fa-truck-fast"></i> ${esc(o.address || '')}${o.delivery_date ? ' · ' + esc(o.delivery_date) : ''}</p>`}
            ${o.items.map(it => `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px dashed var(--line)"><span>${esc(it.product_name)} (${esc(it.size)}) × ${it.quantity}</span><strong>${money(it.unit_price * it.quantity)}</strong></div>`).join('')}
          </div>`;
      } catch (err) {
        out.innerHTML = '<div class="muted" style="padding:16px 0">No encontramos un pedido con esos datos.</div>';
      }
    });
  },

  openProduct(id) {
    const p = this.products.find(x => x.id === id);
    if (!p) return;
    this.currentProduct = p;
    this.selectedSize = null;
    this.qty = 1;
    this.showProductModal();
  },

  showProductModal() {
    const p = this.currentProduct;
    const overlay = document.getElementById('productModal');
    const box = document.getElementById('productModalBox');
    overlay.hidden = false;
    box.hidden = false;

    const sizeOptions = (p.sizes || []).map(s => {
      const sel = this.selectedSize === s.size;
      return `<button class="size-chip ${sel ? 'selected' : ''}" data-size="${esc(s.size)}" ${s.stock <= 0 ? 'disabled' : ''}>
        ${esc(s.size)}<span class="remain">${s.stock > 0 ? (s.stock <= 3 ? `${s.stock} uds` : 'disponible') : 'agotado'}</span>
      </button>`;
    }).join('');

    box.innerHTML = `
      <div class="modal-inner">
        <div class="modal-head">
          <h2>Detalle del producto</h2>
          <button class="modal-close" id="pmClose"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="prod-detail">
          <div class="card-img">
            ${p.image ? imgFallback(p.image) : `<span class="ph">👕</span>`}
            ${p.discount > 0 ? `<span class="disc-badge">-${p.discount}%</span>` : ''}
          </div>
          <div class="prod-info">
            <div class="cat">${esc(p.category)}</div>
            <h2>${esc(p.name)}</h2>
            <div class="price-row" style="margin-top:12px">
              ${p.discount > 0 ? `<span class="price-line" style="font-size:1.05rem">${money(p.list_price)}</span>` : ''}
              <span class="price-lg">${money(p.price)}</span>
            </div>
            ${p.discount > 0 ? `<span class="save-tag"><i class="fa-solid fa-tag"></i> Ahorras ${money(p.list_price - p.price)} (${p.discount}%)</span>` : ''}
            <p class="desc">${esc(p.description)}</p>
            <div class="sizes">
              <span>Elige tu talla *</span>
              <div class="size-options" id="sizeOptions">${sizeOptions}</div>
            </div>
            <div class="qty-row">
              <div class="qty">
                <button id="qtyMinus"><i class="fa-solid fa-minus"></i></button>
                <input id="qtyInput" type="number" value="1" min="1" readonly>
                <button id="qtyPlus"><i class="fa-solid fa-plus"></i></button>
              </div>
              <button class="btn btn-accent btn-block" id="addToCart" ${this.selectedSize ? '' : 'disabled'}>
                <i class="fa-solid fa-cart-plus"></i> Agregar al carrito
              </button>
            </div>
            ${this.selectedSize ? this.stockNote(p) : '<div class="muted" style="margin-top:10px;font-size:.85rem">Selecciona una talla para continuar</div>'}
          </div>
        </div>
      </div>
    `;

    box.querySelector('#pmClose').addEventListener('click', () => this.closeProductModal());
    box.querySelectorAll('[data-size]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        this.selectedSize = btn.dataset.size;
        this.qty = 1;
        this.showProductModal();
      });
    });
    box.querySelector('#qtyMinus').addEventListener('click', () => {
      if (this.qty > 1) { this.qty--; this.showProductModal(); }
    });
    box.querySelector('#qtyPlus').addEventListener('click', () => {
      const size = this.currentProduct.sizes.find(s => s.size === this.selectedSize);
      if (size && this.qty < size.stock) { this.qty++; this.showProductModal(); }
      else toast('No hay más stock de esa talla', 'warn');
    });
    box.querySelector('#addToCart').addEventListener('click', () => this.addToCart());
    overlay.addEventListener('click', () => this.closeProductModal());
  },

  stockNote(p) {
    const size = p.sizes.find(s => s.size === this.selectedSize);
    const remaining = size ? size.stock - this.qty : 0;
    return `<div class="add-feedback" style="margin-top:10px;font-size:.85rem">
      <i class="fa-solid fa-boxes-stacked"></i> Talla <strong>${esc(this.selectedSize)}</strong>: hay <strong>${size.stock}</strong> en stock
      ${remaining <= 2 && remaining >= 0 ? `<span style="color:var(--warn)"> · ¡aprovecha!</span>` : ''}
    </div>`;
  },

  closeProductModal() {
    document.getElementById('productModal').hidden = true;
    document.getElementById('productModalBox').hidden = true;
  },
  closeModal() { this.closeProductModal(); },

  addToCart() {
    if (!this.selectedSize) return;
    const p = this.currentProduct;
    const existing = this.cart.find(c => c.product_id === p.id && c.size === this.selectedSize);
    if (existing) {
      const size = p.sizes.find(s => s.size === this.selectedSize);
      if (size && existing.quantity + this.qty > size.stock) {
        return toast('Ya alcanzaste el stock disponible de esa talla', 'warn');
      }
      existing.quantity += this.qty;
    } else {
      this.cart.push({ product_id: p.id, name: p.name, price: p.price, image: p.image, size: this.selectedSize, quantity: this.qty });
    }
    toast(`${esc(p.name)} (${this.selectedSize}) agregado al carrito`);
    this.persistCart();
    this.closeProductModal();
    this.updateCartUI();
  },

  updateCartUI() {
    const badge = document.getElementById('cartCount');
    const total = this.cart.reduce((a, c) => a + c.quantity, 0);
    badge.hidden = total === 0;
    badge.textContent = total;
  },

  openCart() {
    document.getElementById('cartOverlay').hidden = false;
    document.getElementById('cartDrawer').hidden = false;
    this.renderCart();
  },

  closeCart() {
    document.getElementById('cartOverlay').hidden = true;
    document.getElementById('cartDrawer').hidden = true;
  },

  cartTotals(method) {
    const st = this.settings || {};
    const subtotal = this.cart.reduce((a, c) => a + c.price * c.quantity, 0);
    const coupon = this._coupon ? Math.min(this._coupon.discount, subtotal) : 0;
    const net = subtotal - coupon;
    const retiro = method === 'retiro';
    const fee = Number(st.delivery_fee) || 20000;
    const freeOver = Number(st.free_delivery_over) || 0;
    const shipping = retiro ? 0 : (freeOver > 0 && net >= freeOver ? 0 : fee);
    const ivaPct = Number(st.iva) || 0;
    const tax = ivaPct > 0 && st.iva_calc === 'extra' ? Math.round(net * ivaPct / 100) : 0;
    return { subtotal, coupon, net, shipping, tax, total: net + shipping + tax };
  },

  renderCart() {
    const body = document.getElementById('cartBody');
    if (!this.cart.length) {
      body.innerHTML = `
        <div class="cart-empty"><i class="fa-solid fa-bag-shopping"></i><p>Tu carrito está vacío.<br>Añade prendas desde la tienda.</p></div>
      `;
      return;
    }

    const st = this.settings || {};
    const fee = Number(st.delivery_fee) || 20000;
    const freeOver = Number(st.free_delivery_over) || 0;
    const ivaPct = Number(st.iva) || 0;
    const points = (st.pickup_points || []).map(p => `<option value="${esc(p.name)}">${esc(p.name)} — ${esc(p.address)}${p.hours ? ' · ' + esc(p.hours) : ''}</option>`).join('');
    const slots = (st.pickup_slots || ['09:00 - 12:00', '14:00 - 17:00', '17:00 - 19:00']).map(sl => `<option value="${esc(sl)}">${esc(sl)}</option>`).join('');
    const payMethods = st.payment_methods || { efectivo: true, transferencia: true, qr: true };
    const payments = Object.entries({ efectivo: ['fa-money-bill-wave', 'Efectivo al retirar/recibir'], transferencia: ['fa-building-columns', 'Transferencia bancaria'], qr: ['fa-qrcode', 'Pago con QR / alias'] }).filter(([k]) => payMethods[k]).map(([k, [ic, lbl]]) => `<button type="button" class="method ${k === (this.payMethod || 'efectivo') ? 'active' : ''}" data-pmethod="${k}"><i class="fa-solid ${ic}"></i> ${lbl}</button>`).join('');
    const t = this.cartTotals(this.delMethod || 'envio');

    body.innerHTML = `
      ${this.cart.map((c, i) => `
        <div class="cart-item">
          <div class="thumb">${c.image ? '<span style="width:100%;height:100%;overflow:hidden">' + imgFallback(c.image) + '</span>' : '👕'}</div>
          <div class="ci-info">
            <h4>${esc(c.name)}</h4>
            <div class="ci-meta">Talla ${esc(c.size)} · ${money(c.price)}</div>
            <div class="ci-qty">
              <button class="icon-btn" style="width:30px;height:30px;font-size:.8rem;border:1px solid var(--line);border-radius:8px" data-ciq="-1" data-idx="${i}"><i class="fa-solid fa-minus"></i></button>
              <strong>${c.quantity}</strong>
              <button class="icon-btn" style="width:30px;height:30px;font-size:.8rem;border:1px solid var(--line);border-radius:8px" data-ciq="1" data-idx="${i}"><i class="fa-solid fa-plus"></i></button>
            </div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
            <button class="ci-remove" data-remove="${i}"><i class="fa-solid fa-trash-can"></i></button>
            <span class="ci-price">${money(c.price * c.quantity)}</span>
          </div>
        </div>
      `).join('')}
      <div class="summary-row"><span>Subtotal</span><strong>${money(t.subtotal)}</strong></div>
      <div class="summary-row" id="tCoupon" hidden><span>Cupón <b id="tCouponCode"></b></span><strong style="color:var(--ok)">−0</strong></div>
      <div class="summary-row"><span>Envío ${(this.delMethod || 'envio') === 'retiro' ? '(retiro)' : '(a domicilio)'}</span><strong id="tShip">${money(t.shipping)}</strong></div>
      <div class="summary-row" id="tTaxRow" hidden><span>IVA ${ivaPct}%</span><strong id="tTax">—</strong></div>
      <div class="summary-row total"><span>Total</span><span id="tTotal">${money(t.total)}</span></div>

      <form class="checkout-form" id="checkoutForm">
        <h3 style="font-size:1rem">Datos del pedido</h3>
        <div class="field"><label>Nombre completo *</label><input name="name" required placeholder="Tu nombre"></div>
        <div class="field"><label>Teléfono / WhatsApp *</label>
          <div class="phone-row"><select name="phone_prefix"><option>+595</option><option>+54</option><option>+55</option><option>+52</option><option>+56</option><option>+57</option><option>+58</option><option>+1</option></select><input name="phone" required placeholder="981 000 000"></div>
        </div>
        <div class="field"><label>Email</label><input type="email" name="email" placeholder="tucorreo@mail.com"></div>
        <div class="field">
          <label>Método de entrega</label>
          <div class="methods" id="delMethods">
            <button type="button" class="method active" data-method="envio"><i class="fa-solid fa-truck-fast"></i> Delivery · Envío a domicilio <small>${freeOver > 0 ? 'Gratis desde ' + money(freeOver) : fee ? '+' + money(fee) : 'Gratis'}</small></button>
            <button type="button" class="method" data-method="retiro"><i class="fa-solid fa-shop"></i> Pick up · Retiro en tienda <small>Sin costo</small></button>
          </div>
        </div>
        <div class="field" id="addrField"><label>Dirección de entrega</label><input name="address" placeholder="Calle, número, zona, ciudad"></div>
        <div class="field" id="delivDateField"><label>Fecha de entrega (opcional)</label><input type="date" name="delivery_date"></div>
        <div class="field" id="pickupField" hidden>
          <label>Punto de retiro</label><select name="pickup_point">${points}</select>
          <label style="margin-top:10px">Fecha de tu visita a la tienda</label><input type="date" name="pickup_day">
          <label style="margin-top:10px">Turno de visita</label><select name="pickup_slot">${slots}</select>
        </div>
        <div class="field" id="couponField"><label>Cupón de descuento</label>
          <div style="display:flex;gap:8px"><input name="coupon" placeholder="Ej. VOCCEL10" style="text-transform:uppercase"><button type="button" class="btn btn-outline" id="applyCoupon">Aplicar</button></div>
          <div id="couponInfo" class="mini-note"></div>
        </div>
        <div class="field">
          <label>Método de pago</label>
          <div class="methods" id="payMethods">${payments || '<span class="muted">Sin métodos configurados</span>'}</div>
          <div id="payInfo" class="mini-note"></div>
        </div>
        <div class="field" id="payRefField" hidden><label>Referencia de pago (opcional)</label><input name="payment_ref" placeholder="Nº de transferencia / comprobante"></div>
        <div class="field"><label>Notas (opcional)</label><textarea name="notes" placeholder="Instrucciones de entrega, referencias..."></textarea></div>
        <button class="btn btn-accent btn-block" type="submit" style="font-size:1rem"><i class="fa-solid fa-lock"></i> Confirmar pedido — ${money(t.total)}</button>
      </form>
    `;

    const byId = id => body.querySelector(id);
    const refreshTotals = () => {
      const method = this.delMethod || 'envio';
      const tot = this.cartTotals(method);
      byId('#tShip').textContent = method === 'retiro' ? '—' : (tot.shipping === 0 ? 'Gratis' : money(tot.shipping));
      byId('#tTotal').textContent = money(tot.total);
      const btn = byId('#checkoutForm .btn-block');
      btn.innerHTML = `<i class="fa-solid fa-lock"></i> Confirmar pedido — ${money(tot.total)}`;
      const taxRow = byId('#tTaxRow');
      if (taxRow) { taxRow.hidden = !(ivaPct > 0 && st.iva_calc === 'extra'); byId('#tTax').textContent = money(tot.tax); }
      const coupRow = byId('#tCoupon');
      if (coupRow) {
        if (this._coupon) { coupRow.hidden = false; byId('#tCouponCode').textContent = this._coupon.code; coupRow.querySelector('strong').textContent = '−' + money(this._coupon.discount); }
        else coupRow.hidden = true;
      }
    };
    const payInfoMap = { efectivo: 'Pagás cuando recibís o retirás tu pedido.', transferencia: esc(st.transfer_info || ''), qr: esc(st.qr_info || '') };
    const showPayInfo = pm => {
      const info = byId('#payInfo');
      if (info) info.innerHTML = `<i class="fa-solid fa-circle-info"></i> ${payInfoMap[pm || 'efectivo'] || ''}`;
      byId('#payRefField').hidden = pm === 'efectivo';
    };

    body.querySelectorAll('[data-ciq]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        const delta = Number(btn.dataset.ciq);
        const prod = this.products.find(p => p.id === this.cart[i].product_id);
        const size = prod ? prod.sizes.find(s => s.size === this.cart[i].size) : null;
        if (!prod || !size) {
          this.cart.splice(i, 1);
          this.persistCart();
          this._coupon = null;
          this.renderCart();
          this.updateCartUI();
          toast('Producto ya no disponible: se quitó del carrito', 'warn');
          return;
        }
        const newQty = this.cart[i].quantity + delta;
        if (newQty < 1) { this.cart.splice(i, 1); }
        else if (newQty > size.stock) { toast('Stock máximo disponible alcanzado', 'warn'); }
        else this.cart[i].quantity = newQty;
        this.persistCart();
        this._coupon = null;
        this.updateCartUI();
        this.renderCart();
      });
    });
    body.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.cart.splice(Number(btn.dataset.remove), 1);
        this.persistCart();
        this._coupon = null;
        this.updateCartUI();
        this.renderCart();
      });
    });
    body.querySelectorAll('#delMethods .method').forEach(m => {
      m.addEventListener('click', () => {
        body.querySelectorAll('#delMethods .method').forEach(x => x.classList.remove('active'));
        m.classList.add('active');
        this.delMethod = m.dataset.method;
        const addr = byId('#addrField'), pDate = byId('#pickupField'), dDate = byId('#delivDateField');
        if (this.delMethod === 'retiro') { addr.hidden = true; pDate.hidden = false; dDate.hidden = true; }
        else { addr.hidden = false; pDate.hidden = true; dDate.hidden = false; }
        refreshTotals();
      });
    });
    body.querySelectorAll('#payMethods .method').forEach(m => {
      m.addEventListener('click', () => {
        body.querySelectorAll('#payMethods .method').forEach(x => x.classList.remove('active'));
        m.classList.add('active');
        this.payMethod = m.dataset.pmethod;
        showPayInfo(this.payMethod);
      });
    });
    showPayInfo(this.payMethod || 'efectivo');

    body.querySelector('#applyCoupon').addEventListener('click', async () => {
      const code = byId('input[name=coupon]').value.trim();
      if (!code) return;
      const tot = this.cartTotals(this.delMethod || 'envio');
      try {
        const r = await API.get('/api/coupons/validate?code=' + encodeURIComponent(code) + '&subtotal=' + tot.subtotal);
        this._coupon = { code: r.code, discount: r.discount };
        byId('#couponInfo').innerHTML = `<span style="color:var(--ok)">✓ Cupón aplicado: −${money(r.discount)}</span> <button type="button" class="link-btn" id="clearCoupon">quitar</button>`;
        byId('#clearCoupon').addEventListener('click', () => { this._coupon = null; byId('#couponInfo').innerHTML = ''; byId('input[name=coupon]').value = ''; refreshTotals(); });
        refreshTotals();
      } catch (err) { this._coupon = null; byId('#couponInfo').innerHTML = `<span class="low">✗ ${esc(err.message)}</span>`; refreshTotals(); }
    });

    body.querySelector('#checkoutForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const method = this.delMethod || 'envio';
      const pm = this.payMethod || 'efectivo';
      const payload = {
        customer_name: f.name.value.trim(),
        customer_phone: ((f.phone_prefix ? f.phone_prefix.value : '+595') + (f.phone.value || '').replace(/^0+/, '')) || '',
        customer_email: f.email.value.trim(),
        address: method === 'retiro' ? '' : f.address.value,
        delivery_method: method,
        notes: f.notes.value,
        pickup_date: method === 'retiro' && f.pickup_day.value ? (f.pickup_day.value + ' ' + f.pickup_slot.value) : '',
        pickup_point: method === 'retiro' ? f.pickup_point.value : '',
        delivery_date: method === 'envio' ? f.delivery_date.value : '',
        payment_method: pm,
        payment_ref: pm === 'efectivo' ? '' : f.payment_ref.value,
        coupon: this._coupon ? this._coupon.code : '',
        items: this.cart.map(c => ({ product_id: c.product_id, size: c.size, quantity: c.quantity }))
      };
      const btn = f.querySelector('.btn-block');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
      try {
        const res = await API.post('/api/checkout', payload);
        this.clearCart();
        try { localStorage.setItem('voccela.lastOrder', String(res.sale_id)); } catch (err) {}
        this.updateCartUI();
        this._coupon = null;
        Store.load().then(() => Store.render());
        const payNote = payload.payment_method === 'transferencia'
          ? `📲 Para pagar: ${esc(st.transfer_info || 'transferencia bancaria')}`
          : payload.payment_method === 'qr' ? `📲 ${esc(st.qr_info || 'Te pasamos el QR para el pago.')}` : '';
        f.innerHTML = `
          <div class="order-success">
            <div class="big"><i class="fa-solid fa-circle-check"></i></div>
            <h3>¡Pedido confirmado!</h3>
            <div class="muted">Guardamos tu número de pedido:</div>
            <div class="oid">#${res.sale_id}</div>
            <div class="muted" style="margin:10px 0 18px">Total: <strong>${money(res.total)}</strong><br>El inventario ya fue actualizado.
            ${res.coupon_discount ? `<br>Cupón aplicado: <strong>−${money(res.coupon_discount)}</strong>` : ''}
            ${payNote ? `<br>${payNote}` : ''}
            ${method === 'retiro' && payload.pickup_date ? `<br>Te esperamos <strong>${esc(payload.pickup_date)}</strong> en <strong>${esc(payload.pickup_point)}</strong>.` : ''}
            ${method === 'envio' && f.delivery_date.value ? `<br>Entrega estimada para el <strong>${esc(f.delivery_date.value)}</strong>.` : ''}
            </div>
            <button type="button" class="btn btn-primary" data-close-cart><i class="fa-solid fa-store"></i> Seguir comprando</button>
          </div>
        `;
        f.querySelector('[data-close-cart]').addEventListener('click', () => this.closeCart());
      } catch (err) {
        toast(err.message, 'err');
        btn.disabled = false;
        btn.innerHTML = `<i class="fa-solid fa-lock"></i> Confirmar pedido`;
      }
    });
  }
};