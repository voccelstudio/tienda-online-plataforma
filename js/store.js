const Store = {
  products: [],
  categories: [],
  filterCat: 'todas',
  search: '',
  sort: 'nuevos',
  cart: [],
  selectedSize: null,
  qty: 1,
  currentProduct: null,

  async load() {
    this.products = await API.get('/api/products');
    const cats = [...new Set(this.products.map(p => p.category))];
    cats.sort((a, b) => a.localeCompare(b));
    this.categories = cats;
  },

  render() {
    const app = document.getElementById('app');
    const filtered = this.filteredProducts();

    app.innerHTML = `
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
          <select class="select" id="storeSort">
            <option value="nuevos" ${this.sort === 'nuevos' ? 'selected' : ''}>Más nuevos</option>
            <option value="precio-asc" ${this.sort === 'precio-asc' ? 'selected' : ''}>Precio: menor a mayor</option>
            <option value="precio-desc" ${this.sort === 'precio-desc' ? 'selected' : ''}>Precio: mayor a menor</option>
            <option value="stock" ${this.sort === 'stock' ? 'selected' : ''}>Con más stock</option>
          </select>
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
    app.querySelectorAll('[data-open-product]').forEach(el => {
      el.addEventListener('click', () => this.openProduct(Number(el.dataset.openProduct)));
    });
    this.updateCartUI();
  },

  filteredProducts() {
    let list = [...this.products];
    if (this.filterCat !== 'todas') list = list.filter(p => p.category === this.filterCat);
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

  renderCart() {
    const body = document.getElementById('cartBody');
    if (!this.cart.length) {
      body.innerHTML = `
        <div class="cart-empty"><i class="fa-solid fa-bag-shopping"></i><p>Tu carrito está vacío.<br>Añade prendas desde la tienda.</p></div>
      `;
      return;
    }

    const subtotal = this.cart.reduce((a, c) => a + c.price * c.quantity, 0);
    const shipping = 20000;

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
      <div class="summary-row"><span>Subtotal</span><strong>${money(subtotal)}</strong></div>
      <div class="summary-row"><span>Envío (a domicilio)</span><strong>${money(shipping)}</strong></div>
      <div class="summary-row total"><span>Total</span><span>${money(subtotal + shipping)}</span></div>

      <form class="checkout-form" id="checkoutForm">
        <h3 style="font-size:1rem">Datos del pedido</h3>
        <div class="field"><label>Nombre completo *</label><input name="name" required placeholder="Tu nombre"></div>
        <div class="field"><label>Teléfono / WhatsApp</label><input name="phone" placeholder="+52 ..."></div>
        <div class="field"><label>Email</label><input type="email" name="email" placeholder="tucorreo@mail.com"></div>
        <div class="field">
          <label>Método de entrega</label>
          <div class="methods" id="delMethods">
            <button type="button" class="method active" data-method="envio"><i class="fa-solid fa-truck-fast"></i> Delivery · Envío a domicilio <small>+ ${money(shipping)}</small></button>
            <button type="button" class="method" data-method="retiro"><i class="fa-solid fa-shop"></i> Pick up · Retiro en tienda <small>Sin costo</small></button>
          </div>
        </div>
        <div class="field" id="addrField"><label>Dirección de entrega</label><input name="address" placeholder="Calle, número, colonia, ciudad"></div>
        <div class="field" id="delivDateField"><label>Fecha de entrega (opcional)</label><input type="date" name="delivery_date"></div>
        <div class="field" id="pickupField" hidden><label>Fecha y hora de tu visita a la tienda (opcional)</label><input type="datetime-local" name="pickup_date"></div>
        <div class="field"><label>Notas (opcional)</label><textarea name="notes" placeholder="Instrucciones de entrega, referencias..."></textarea></div>
        <button class="btn btn-accent btn-block" type="submit" style="font-size:1rem"><i class="fa-solid fa-lock"></i> Confirmar pedido — ${money(subtotal + shipping)}</button>
      </form>
    `;

    body.querySelectorAll('[data-ciq]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        const delta = Number(btn.dataset.ciq);
        const size = this.products.find(p => p.id === this.cart[i].product_id).sizes.find(s => s.size === this.cart[i].size);
        const newQty = this.cart[i].quantity + delta;
        if (newQty < 1) { this.cart.splice(i, 1); }
        else if (newQty > size.stock) { toast('Stock máximo disponible alcanzado', 'warn'); }
        else this.cart[i].quantity = newQty;
        this.updateCartUI();
        this.renderCart();
      });
    });
    body.querySelectorAll('[data-remove]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.cart.splice(Number(btn.dataset.remove), 1);
        this.updateCartUI();
        this.renderCart();
      });
    });
    body.querySelectorAll('.method').forEach(m => {
      m.addEventListener('click', () => {
        body.querySelectorAll('.method').forEach(x => x.classList.remove('active'));
        m.classList.add('active');
        const addr = body.querySelector('#addrField');
        const pDate = body.querySelector('#pickupField');
        const dDate = body.querySelector('#delivDateField');
        if (m.dataset.method === 'retiro') { addr.hidden = true; pDate.hidden = false; dDate.hidden = true; }
        else { addr.hidden = false; pDate.hidden = true; dDate.hidden = false; }
        const submit = body.querySelector('#checkoutForm .btn-block');
        const fee = m.dataset.method === 'retiro' ? 0 : shipping;
        submit.innerHTML = `<i class="fa-solid fa-lock"></i> Confirmar pedido — ${money(subtotal + fee)}`;
      });
    });

    body.querySelector('#checkoutForm').addEventListener('submit', async e => {
      e.preventDefault();
      const f = e.target;
      const method = f.querySelector('.method.active').dataset.method;
      const payload = {
        customer_name: f.name.value,
        customer_phone: f.phone.value,
        customer_email: f.email.value,
        address: method === 'retiro' ? '' : f.address.value,
        delivery_method: method,
        notes: f.notes.value,
        pickup_date: method === 'retiro' ? f.pickup_date.value : '',
        delivery_date: method === 'envio' ? f.delivery_date.value : '',
        items: this.cart.map(c => ({ product_id: c.product_id, size: c.size, quantity: c.quantity }))
      };
      const btn = f.querySelector('.btn-block');
      btn.disabled = true;
      btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Procesando...';
      try {
        const res = await API.post('/api/checkout', payload);
        this.cart = [];
        this.updateCartUI();
        Store.load().then(() => Store.render());
        f.innerHTML = `
          <div class="order-success">
            <div class="big"><i class="fa-solid fa-circle-check"></i></div>
            <h3>¡Pedido confirmado!</h3>
            <div class="muted">Guardamos tu número de pedido:</div>
            <div class="oid">#${res.sale_id}</div>
            <div class="muted" style="margin:10px 0 18px">Total: <strong>${money(res.total)}</strong><br>El inventario ya fue actualizado.
            ${method === 'retiro' && f.pickup_date.value ? `<br>Te esperamos <strong>${esc(f.pickup_date.value)}</strong> en la tienda.` : ''}
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