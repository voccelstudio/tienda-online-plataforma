const Admin = {
  tab: 'dashboard',
  products: [],
  orders: [],
  stats: null,
  inventory: [],
  editingProduct: null,
  searchQ: '',
  statusFilter: 'all',
  delFilter: 'all',
  reportFrom: '',
  reportTo: '',
  reportGroup: 'day',

  async load() {
    await Promise.all([
      this.loadStats(),
      this.loadInventory(),
      this.loadOrders()
    ]);
  },

  async loadStats() { this.stats = await API.get('/api/stats'); },
  async loadOrders() {
    let url = '/api/orders';
    const q = [];
    if (this.statusFilter !== 'all') q.push('status=' + this.statusFilter);
    if (this.searchQ) q.push('q=' + encodeURIComponent(this.searchQ));
    if (q.length) url += '?' + q.join('&');
    this.orders = await API.get(url);
  },
  async loadInventory() { this.inventory = await API.get('/api/inventory'); },

  render() {
    const app = document.getElementById('app');
    const tabs = [
      ['dashboard', 'Indicator', 'Panel'],
      ['inventario', 'boxes-stacked', 'Inventario'],
      ['pedidos', 'clipboard-list', 'Pedidos'],
      ['delivery', 'truck-fast', 'Delivery'],
      ['reportes', 'chart-line', 'Reportes']
    ];
    app.innerHTML = `
      <div class="container admin-shell">
        <nav class="side-tabs">
          ${tabs.map(([k, icon, label]) => `
            <button class="side-tab ${this.tab === k ? 'active' : ''}" data-atab="${k}">
              <i class="fa-solid fa-${icon}"></i> ${label}
            </button>
          `).join('')}
        </nav>
        <section id="adminContent">
          ${this.tab === 'dashboard' ? this.dashboardHTML() : ''}
          ${this.tab === 'inventario' ? this.inventoryHTML() : ''}
          ${this.tab === 'pedidos' ? this.ordersHTML() : ''}
          ${this.tab === 'delivery' ? this.deliveryHTML() : ''}
          ${this.tab === 'reportes' ? this.reportsHTML() : ''}
        </section>
      </div>
    `;

    app.querySelectorAll('[data-atab]').forEach(b => b.addEventListener('click', () => {
      this.tab = b.dataset.atab;
      if (this.tab === 'reportes') this.evalReport();
      this.render();
    }));

    if (this.tab === 'dashboard') this.dashboardBind();
    if (this.tab === 'inventario') this.inventoryBind();
    if (this.tab === 'pedidos') this.ordersBind();
    if (this.tab === 'delivery') this.deliveryBind();
    if (this.tab === 'reportes') { this.reportBind(); this.evalReport(); }
  },

  // ---------------- DASHBOARD ----------------
  dashboardHTML() {
    const s = this.stats || {};
    const recent = this.orders.slice(0, 6);
    const low = this.inventory.filter(p => totalStock(p.sizes) <= 4 || lowestStock(p.sizes) <= 2).slice(0, 6);
    const statusIcon = { pendiente: 'fa-hourglass-half', confirmado: 'fa-check', enviado: 'fa-truck-fast', entregado: 'fa-box-open', cancelado: 'fa-ban' };
    return `
      <div class="panel-head"><h2><i class="fa-solid fa-gauge-high"></i> Panel de control</h2>
        <span class="muted">Vista general de la tienda</span>
      </div>
      <div class="stat-cards">
        <div class="stat-card accent"><div class="lbl">Ventas de hoy</div><div class="num">${money(s.sales_today || 0)}</div><span class="muted" style="font-size:.8rem">${s.orders_today || 0} pedidos</span></div>
        <div class="stat-card warn"><div class="lbl">Pedidos por atender</div><div class="num">${s.pending_orders || 0}</div><span class="muted" style="font-size:.8rem">pendientes / enviados</span></div>
        <div class="stat-card"><div class="lbl">Productos activos</div><div class="num">${s.active_products || 0}</div></div>
        <div class="stat-card"><div class="lbl">Unidades vendidas</div><div class="num">${s.units_sold || 0}</div></div>
        <div class="stat-card ok"><div class="lbl">Valor en inventario</div><div class="num">${money(s.inventory_value || 0)}</div></div>
        <div class="stat-card ${s.low_stock > 0 ? 'warn' : 'ok'}"><div class="lbl">Alertas de stock bajo</div><div class="num">${s.low_stock || 0}</div></div>
      </div>
      <div class="two-col">
        <div class="panel-card">
          <h3><i class="fa-solid fa-clock-rotate-left"></i> Últimos pedidos</h3>
          ${recent.length ? `
            <div class="table-wrap">
              <table>
                <thead><tr><th>#</th><th>Cliente</th><th>Total</th><th>Estado</th></tr></thead>
                <tbody>
                  ${recent.map(o => `
                    <tr style="cursor:pointer" data-open-order="${o.id}">
                      <td><strong>#${o.id}</strong></td>
                      <td>${esc(o.customer_name)}</td>
                      <td>${money(o.total)}</td>
                      <td><span class="status ${o.status}"><i class="fa-solid ${statusIcon[o.status]}"></i> ${o.status}</span></td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>
          ` : `<div class="muted">Aún no hay pedidos.</div>`}
        </div>
        <div class="panel-card">
          <h3><i class="fa-solid fa-triangle-exclamation"></i> Stock bajo</h3>
          ${low.length ? `
            ${low.map(p => `
              <div class="bar-row" style="margin-bottom:10px">
                <span style="font-weight:600">${esc(p.name)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.min(100, Math.max(4, totalStock(p.sizes) / Math.max(1, this.maxStock()) * 100))}%;background:${totalStock(p.sizes) <= 4 ? 'var(--danger)' : 'var(--warn)'}"></div></div>
                <span class="${totalStock(p.sizes) <= 4 ? 'low' : 'mid'}">${totalStock(p.sizes)} uds</span>
              </div>`).join('')}
          ` : `<div class="muted" style="display:flex;gap:8px;align-items:center"><i class="fa-solid fa-circle-check ok"></i> Todo el stock está saludable.</div>`}
        </div>
      </div>
    `;
  },
  maxStock() { return Math.max(1, ...this.inventory.map(p => totalStock(p.sizes))) * 0.5; },

  dashboardBind() {
    document.querySelectorAll('[data-open-order]').forEach(el => {
      el.addEventListener('click', () => this.openOrder(Number(el.dataset.openOrder)));
    });
  },

  // ---------------- INVENTARIO ----------------
  inventoryHTML() {
    return `
      <div class="panel-head">
        <h2><i class="fa-solid fa-boxes-stacked"></i> Inventario y stock</h2>
        <button class="btn btn-accent" id="addProduct"><i class="fa-solid fa-plus"></i> Nuevo producto</button>
      </div>
      <div class="toolbar" style="margin:0 0 16px">
        <div class="search-box grow"><i class="fa-solid fa-magnifying-glass"></i><input id="invSearch" placeholder="Buscar producto..."></div>
        <span class="muted">${this.inventory.length} productos</span>
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr><th></th><th>Producto</th><th>Categoría</th><th>Precio</th><th>Stock por talla</th><th>Total</th><th>Vendidos</th><th>Estado</th><th>Acciones</th></tr>
          </thead>
          <tbody id="invBody"></tbody>
        </table>
      </div>
    `;
  },

  inventoryRowHTML(p) {
    const total = totalStock(p.sizes);
    const sizeCells = p.sizes.map(s => `
      <td style="text-align:center" title="${esc(s.size)}">
        <span class="muted" style="font-size:.72rem">${esc(s.size)}</span><br>
        <span class="${s.stock <= 0 ? 'low' : s.stock <= 3 ? 'mid' : ''}">${s.stock}</span>
      </td>`).join('');
    const state = !p.active ? '<span class="status cancelado">inactivo</span>'
      : total === 0 ? '<span class="status cancelado">agotado</span>'
      : total <= 4 ? '<span class="status pendiente">bajo</span>'
      : '<span class="status entregado">ok</span>';
    return `
      <tr data-invrow="${p.id}">
        <td>${thumb(p.image)}</td>
        <td><strong>${esc(p.name)}</strong><div class="muted" style="font-size:.78rem">#${p.id}</div></td>
        <td>${esc(p.category)}</td>
        <td><strong>${money(p.price)}</strong></td>
        <td style="white-space:normal">${sizeCells}</td>
        <td><strong>${total}</strong></td>
        <td>${p.units_sold}</td>
        <td>${state}</td>
        <td>
          <button class="btn btn-sm btn-outline" data-edit-product="${p.id}"><i class="fa-solid fa-pen"></i></button>
          <button class="btn btn-sm btn-outline" data-stock-product="${p.id}"><i class="fa-solid fa-boxes-stacked"></i></button>
          <button class="btn btn-sm btn-danger" data-del-product="${p.id}"><i class="fa-solid fa-trash"></i></button>
        </td>
      </tr>`;
  },

  inventoryBind() {
    const tbody = document.getElementById('invBody');
    const draw = () => {
      const q = this.invSearchVal ? this.invSearchVal.toLowerCase() : '';
      const list = this.inventory.filter(p => !q || (p.name + ' ' + p.category).toLowerCase().includes(q));
      tbody.innerHTML = list.map(p => this.inventoryRowHTML(p)).join('') || '<tr><td colspan="9" class="muted" style="text-align:center">Sin resultados</td></tr>';
    };
    const input = document.getElementById('invSearch');
    input.addEventListener('input', () => { this.invSearchVal = input.value; draw(); });

    tbody.addEventListener('click', e => {
      const edit = e.target.closest('[data-edit-product]');
      const stock = e.target.closest('[data-stock-product]');
      const del = e.target.closest('[data-del-product]');
      if (edit) this.openProductAdmin(Number(edit.dataset.editProduct), 'form');
      else if (stock) this.openProductAdmin(Number(stock.dataset.stockProduct), 'stock');
      else if (del) this.deleteProduct(Number(del.dataset.delProduct));
    });

    document.getElementById('addProduct').addEventListener('click', () => this.openProductAdmin(null, 'form'));
    draw();
  },

  async deleteProduct(id) {
    const p = this.inventory.find(x => x.id === id);
    if (!p) return;
    if (!confirm(`¿Eliminar "${p.name}" definitivamente?`)) return;
    try {
      await API.del('/api/products/' + id);
      toast('Producto eliminado');
      await this.loadInventory();
      this.render();
    } catch (e) { toast(e.message, 'err'); }
  },

  openProductAdmin(id, mode) {
    const p = id ? this.inventory.find(x => x.id === id) : null;
    this.editingProduct = p ? { ...p, sizes: (p.sizes || []).map(s => ({ ...s })) } : { name: '', description: '', category: 'Camisetas', price: '', image: '', active: true, sizes: [{ size: 'S', stock: 0 }, { size: 'M', stock: 0 }, { size: 'L', stock: 0 }, { size: 'XL', stock: 0 }] };
    const overlay = document.getElementById('prodAdminModal');
    const box = document.getElementById('prodAdminModalBox');
    overlay.hidden = false;
    box.hidden = false;

    const categories = ['Camisetas', 'Sudaderas', 'Pantalones', 'Chaquetas', 'Deportivo', 'Accesorios'];
    const e = this.editingProduct;
    box.innerHTML = `
      <div class="modal-inner">
        <div class="modal-head">
          <h2>${p ? 'Editar producto' : 'Nuevo producto'}</h2>
          <button class="modal-close" id="paClose"><i class="fa-solid fa-xmark"></i></button>
        </div>
        ${mode === 'form' ? `
          <form id="prodAdminForm" class="form-grid">
            <div class="field"><label>Nombre *</label><input name="name" value="${esc(e.name)}" required></div>
            <div class="field"><label>Categoría</label>
              <select name="category">${categories.map(c => `<option ${e.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                <option ${!categories.includes(e.category) ? 'selected' : ''} value="${esc(e.category)}">${esc(e.category) || 'Otra'}</option>
              </select>
            </div>
            <div class="field"><label>Precio (USD) *</label><input name="price" type="number" step="0.01" min="0" value="${e.price}" required></div>
            <div class="field"><label>Imagen (URL)</label><input name="image" value="${esc(e.image)}" placeholder="https://..."></div>
            <div class="field full"><label>Descripción</label><textarea name="description">${esc(e.description)}</textarea></div>
            <div class="full" style="display:flex;gap:10px;align-items:center">
              <label style="display:flex;gap:8px;align-items:center;font-weight:700"><input type="checkbox" name="active" ${e.active ? 'checked' : ''}> Producto activo en tienda</label>
            </div>
            <div class="full" style="display:flex;gap:10px;justify-content:flex-end">
              <button type="button" class="btn btn-outline" id="paCancel">Cancelar</button>
              <button class="btn btn-accent" type="submit"><i class="fa-solid fa-floppy-disk"></i> Guardar producto</button>
            </div>
          </form>
        ` : `
          <p class="muted" style="margin-bottom:14px">Edita el stock por talla de <strong>${esc(e.name)}</strong>. El inventario se sincroniza automáticamente con la tienda.</p>
          <table class="table-wrap size-stock-table" style="width:100%;box-shadow:none">
            <thead><tr><th>Talla</th><th>Stock</th></tr></thead>
            <tbody id="stockRows">
              ${e.sizes.map((s, i) => `
                <tr data-sr="${i}">
                  <td><strong>${esc(s.size)}</strong></td>
                  <td><input type="number" min="0" value="${s.stock}" data-stock-input="${i}"></td>
                </tr>`).join('')}
              <tr>
                <td><button type="button" class="btn btn-sm btn-outline" id="addSize"><i class="fa-solid fa-plus"></i> Añadir talla</button></td>
                <td class="muted" style="font-size:.8rem" id="stockTotal"></td>
              </tr>
            </tbody>
          </table>
          <div style="display:flex;gap:10px;justify-content:flex-end;margin-top:16px">
            <button type="button" class="btn btn-outline" data-pa-close>Cancelar</button>
            <button class="btn btn-accent" id="saveStock"><i class="fa-solid fa-floppy-disk"></i> Guardar stock</button>
          </div>
        `}
      </div>
    `;

    const close = () => { overlay.hidden = true; box.hidden = true; };
    box.querySelector('#paClose').addEventListener('click', close);
    overlay.addEventListener('click', close);
    const cancelBtn = box.querySelector('#paCancel');
    if (cancelBtn) cancelBtn.addEventListener('click', close);
    box.querySelectorAll('[data-pa-close]').forEach(b => b.addEventListener('click', close));

    const fc = box.querySelector('#prodAdminForm');
    if (fc) {
      fc.addEventListener('submit', async ev => {
        ev.preventDefault();
        const f = ev.target;
        const payload = {
          name: f.name.value,
          description: f.description.value,
          category: f.category.value,
          price: Number(f.price.value),
          image: f.image.value,
          active: f.active.checked
        };
        try {
          if (id) await API.put('/api/products/' + id, payload);
          else await API.post('/api/products', { ...payload, sizes: this.editingProduct.sizes });
          toast('Producto guardado');
          await this.loadInventory();
          close();
          this.render();
        } catch (e) { toast(e.message, 'err'); }
      });
    }

    const addSizeBtn = box.querySelector('#addSize');
    if (addSizeBtn) {
      addSizeBtn.addEventListener('click', () => {
        const size = prompt('Nombre de la nueva talla (ej. XXL, 32/32):');
        if (size && size.trim()) {
          this.editingProduct.sizes.push({ size: size.trim(), stock: 0 });
          this.openProductAdmin(id, 'stock');
        }
      });
      const upd = () => {
        const totals = box.querySelectorAll('[data-stock-input]');
        this.editingProduct.sizes.forEach((s, i) => { const v = totals[i]; if (v) s.stock = Number(v.value || 0); });
        const tt = document.getElementById('stockTotal');
        tt.textContent = 'Total: ' + this.editingProduct.sizes.reduce((a, s) => a + s.stock, 0) + ' uds';
      };
      box.querySelectorAll('[data-stock-input]').forEach(inp => inp.addEventListener('input', upd));
      upd();
      box.querySelector('#saveStock').addEventListener('click', async () => {
        upd();
        try {
          await API.put('/api/products/' + e.id, { sizes: this.editingProduct.sizes });
          toast('Stock actualizado');
          await this.loadInventory();
          close();
          this.render();
        } catch (err) { toast(err.message, 'err'); }
      });
    }
  },

  // ---------------- PEDIDOS ----------------
  ordersHTML() {
    const statuses = ['all', ...['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado']];
    return `
      <div class="panel-head">
        <h2><i class="fa-solid fa-clipboard-list"></i> Pedidos</h2>
        <div class="toolbar" style="margin:0">
          <div class="search-box"><i class="fa-solid fa-magnifying-glass"></i><input id="orderSearch" placeholder="Buscar por cliente, tel o #" value="${esc(this.searchQ)}"></div>
          <select class="select" id="orderStatusFilter">
            ${statuses.map(s => `<option value="${s}" ${this.statusFilter === s ? 'selected' : ''}>${s === 'all' ? 'Todos los estados' : s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>#</th><th>Cliente</th><th>Fecha</th><th>Entrega</th><th>Artículos</th><th>Total</th><th>Estado</th><th></th></tr></thead>
          <tbody>
            ${this.orders.length ? this.orders.map(o => {
              const st = o.status;
              const method = o.delivery_method === 'envio'
                ? `<i class="fa-solid fa-truck-fast"></i> Envío${o.delivery && o.delivery.status == 'entregado' ? ' ✓' : ''}`
                : '<i class="fa-solid fa-shop"></i> Retiro';
              return `
                <tr style="cursor:pointer" data-open-order="${o.id}">
                  <td><strong>#${o.id}</strong></td>
                  <td>${esc(o.customer_name)}<div class="muted" style="font-size:.76rem">${esc(o.customer_phone || '')}</div></td>
                  <td>${esc(o.created_at)}</td>
                  <td>${method}</td>
                  <td>${o.items.reduce((a, i) => a + i.quantity, 0)}</td>
                  <td><strong>${money(o.total)}</strong></td>
                  <td><span class="status ${st}"><i class="fa-solid fa-${st === 'entregado' ? 'box-open' : st === 'enviado' ? 'truck-fast' : st === 'cancelado' ? 'ban' : st === 'confirmado' ? 'check' : 'hourglass-half'}"></i> ${st}</span></td>
                  <td><button class="btn btn-sm btn-outline" data-open-order="${o.id}"><i class="fa-solid fa-eye"></i></button></td>
                </tr>`;
            }).join('') : '<tr><td colspan="8" class="muted" style="text-align:center">Sin pedidos con ese filtro</td></tr>'}
          </tbody>
        </table>
      </div>
    `;
  },

  ordersBind() {
    document.getElementById('orderSearch').addEventListener('input', e => {
      clearTimeout(this._osT);
      this._osT = setTimeout(() => { this.searchQ = e.target.value; this.refreshOrders(); }, 300);
    });
    document.getElementById('orderStatusFilter').addEventListener('change', e => {
      this.statusFilter = e.target.value;
      this.refreshOrders();
    });
    document.querySelectorAll('[data-open-order]').forEach(el => {
      el.addEventListener('click', () => this.openOrder(Number(el.dataset.openOrder)));
    });
  },

  async refreshOrders() {
    await this.loadOrders();
    this.render();
  },

  async openOrder(id) {
    const o = await API.get('/api/orders/' + id);
    const overlay = document.getElementById('orderModal');
    const box = document.getElementById('orderModalBox');
    overlay.hidden = false;
    box.hidden = false;
    const statuses = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
    const statusIcon = { pendiente: 'fa-hourglass-half', confirmado: 'fa-check', enviado: 'fa-truck-fast', entregado: 'fa-box-open', cancelado: 'fa-ban' };

    box.innerHTML = `
      <div class="modal-inner">
        <div class="modal-head">
          <h2>Pedido #${o.id} <span class="status ${o.status}"><i class="fa-solid ${statusIcon[o.status]}"></i> ${o.status}</span></h2>
          <button class="modal-close" data-o-close><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="two-col">
          <div class="panel-card" style="box-shadow:none;border:1px solid var(--line)">
            <h3><i class="fa-solid fa-user"></i> Cliente</h3>
            <p><strong>${esc(o.customer_name)}</strong></p>
            <p class="muted"><i class="fa-solid fa-phone"></i> ${esc(o.customer_phone || '—')}</p>
            <p class="muted"><i class="fa-solid fa-envelope"></i> ${esc(o.customer_email || '—')}</p>
            <h3 style="margin-top:16px"><i class="fa-solid fa-truck"></i> Entrega</h3>
            ${o.delivery_method === 'envio' ? `
              <p class="muted"><strong>Dirección:</strong> ${esc(o.address || '—')}</p>
              ${o.delivery ? `
                <p class="muted">Mensajería: <strong>${esc(o.delivery.courier || '—')}</strong></p>
                <p class="muted">Tracking: <strong>${esc(o.delivery.tracking_number || '—')}</strong></p>
                <p class="muted">Estado delivery: <span class="status ${o.delivery.status}">${o.delivery.status.replace('_', ' ')}</span></p>
              ` : ''}
            ` : '<p class="muted">Retiro en tienda.</p>'}
            ${o.notes ? `<p class="muted"><i class="fa-solid fa-note-sticky"></i> ${esc(o.notes)}</p>` : ''}
            <p class="muted" style="font-size:.8rem;margin-top:10px">Registrado: ${esc(o.created_at)}</p>
          </div>
          <div class="panel-card" style="box-shadow:none;border:1px solid var(--line)">
            <h3><i class="fa-solid fa-bag-shopping"></i> Artículos</h3>
            ${o.items.map(it => `
              <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px dashed var(--line)">
                <div><strong>${esc(it.product_name)}</strong><div class="muted" style="font-size:.8rem">Talla ${esc(it.size)} × ${it.quantity}</div></div>
                <strong>${money(it.unit_price * it.quantity)}</strong>
              </div>`).join('')}
            <div class="summary-row" style="margin-top:10px"><span>Subtotal</span><span>${money(o.subtotal)}</span></div>
            <div class="summary-row"><span>Envío</span><span>${o.delivery_method === 'envio' ? money(o.shipping_fee) : 'Sin costo'}</span></div>
            <div class="summary-row total"><span>Total</span><span>${money(o.total)}</span></div>
          </div>
        </div>
        <div style="display:flex;gap:14px;align-items:center;justify-content:space-between;margin-top:18px;flex-wrap:wrap">
          <div class="field" style="min-width:220px">
            <label>Cambiar estado del pedido</label>
            <select id="orderStatusSel">
              ${statuses.map(s => `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-accent" id="saveOrderStatus"><i class="fa-solid fa-floppy-disk"></i> Guardar estado</button>
        </div>
        ${o.delivery_method === 'envio' ? `
          <div style="margin-top:18px;border-top:1px solid var(--line);padding-top:14px">
            <h3 style="font-size:.95rem;margin-bottom:10px"><i class="fa-solid fa-truck-fast"></i> Gestión de delivery</h3>
            <div class="form-grid">
              <div class="field"><label>Mensajería / Courier</label><input id="dCourier" value="${esc(o.delivery?.courier || '')}" placeholder="Ej. UPS, DHL, repartidor propio"></div>
              <div class="field"><label>N° de tracking</label><input id="dTracking" value="${esc(o.delivery?.tracking_number || '')}" placeholder="Ej. 1Z999999"></div>
              <div class="field"><label>Fecha estimada</label><input id="dEstimated" value="${esc(o.delivery?.estimated_date || '')}" placeholder="2026-09-20"></div>
              <div class="field"><label>Estado delivery</label>
                <select id="dStatus">
                  <option value="pendiente" ${o.delivery?.status === 'pendiente' ? 'selected' : ''}>Pendiente</option>
                  <option value="en_reparto" ${o.delivery?.status === 'en_reparto' ? 'selected' : ''}>En reparto</option>
                  <option value="entregado" ${o.delivery?.status === 'entregado' ? 'selected' : ''}>Entregado</option>
                </select>
              </div>
            </div>
            <button class="btn btn-outline" style="margin-top:12px" id="saveDelivery"><i class="fa-solid fa-truck-fast"></i> Guardar entrega</button>
          </div>` : ''}
      </div>
    `;

    const close = () => { overlay.hidden = true; box.hidden = true; };
    box.querySelectorAll('[data-o-close]').forEach(b => b.addEventListener('click', close));
    overlay.addEventListener('click', close);

    box.querySelector('#saveOrderStatus').addEventListener('click', async () => {
      const st = box.querySelector('#orderStatusSel').value;
      if (st === o.status) return;
      if (st === 'cancelado' && !confirm('Al cancelar se devolverá el stock a inventario. ¿Continuar?')) return;
      try {
        await API.put('/api/orders/' + o.id, { status: st });
        toast('Estado actualizado a ' + st);
        await this.loadOrders();
        await this.loadStats();
        close();
        this.render();
      } catch (e) { toast(e.message, 'err'); }
    });

    const saveD = box.querySelector('#saveDelivery');
    if (saveD) {
      saveD.addEventListener('click', async () => {
        try {
          await API.put('/api/delivery/' + o.id, {
            courier: box.querySelector('#dCourier').value,
            tracking_number: box.querySelector('#dTracking').value,
            estimated_date: box.querySelector('#dEstimated').value,
            status: box.querySelector('#dStatus').value
          });
          toast('Entrega actualizada');
          await this.loadOrders();
          close();
          this.render();
        } catch (e) { toast(e.message, 'err'); }
      });
    }
  },

  // ---------------- DELIVERY ----------------
  deliveryHTML() {
    const envios = this.orders.filter(o => o.delivery_method === 'envio' && o.status !== 'cancelado');
    return `
      <div class="panel-head">
        <h2><i class="fa-solid fa-truck-fast"></i> Envios y delivery</h2>
        <select class="select" id="delFilter">
          ${['all', 'pendiente', 'en_reparto', 'entregado', 'devuelto'].map(s =>
            `<option value="${s}" ${this.delFilter === s ? 'selected' : ''}>${s === 'all' ? 'Todos' : s.replace('_', ' ').charAt(0).toUpperCase() + s.replace('_', ' ').slice(1)}</option>`).join('')}
        </select>
      </div>
      ${envios.length ? `
        <div class="stat-cards">
          <div class="stat-card"><div class="lbl">Envios totales</div><div class="num">${envios.length}</div></div>
          <div class="stat-card warn"><div class="lbl">Pendientes</div><div class="num">${envios.filter(o => o.delivery?.status === 'pendiente').length}</div></div>
          <div class="stat-card accent"><div class="lbl">En reparto</div><div class="num">${envios.filter(o => o.delivery?.status === 'en_reparto').length}</div></div>
          <div class="stat-card ok"><div class="lbl">Entregados</div><div class="num">${envios.filter(o => o.delivery?.status === 'entregado').length}</div></div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>#</th><th>Cliente</th><th>Dirección</th><th>Courier</th><th>Tracking</th><th>Estado delivery</th><th>Volumen</th></tr></thead>
            <tbody>
              ${envios.filter(o => this.delFilter === 'all' || o.delivery?.status === this.delFilter).map(o => `
                <tr style="cursor:pointer" data-open-order="${o.id}">
                  <td><strong>#${o.id}</strong></td>
                  <td>${esc(o.customer_name)}</td>
                  <td style="white-space:normal;max-width:260px">${esc(o.address || '—')}</td>
                  <td>${esc(o.delivery?.courier || '—')}</td>
                  <td>${esc(o.delivery?.tracking_number || '—')}</td>
                  <td><span class="status ${o.delivery?.status || 'pendiente'}">${(o.delivery?.status || 'pendiente').replace('_', ' ')}</span></td>
                  <td>${o.items.reduce((a, i) => a + i.quantity, 0)} pzas</td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      ` : '<div class="cart-empty"><i class="fa-solid fa-truck-fast"></i><p>Aún no hay pedidos para enviar.</p></div>'}
    `;
  },

  deliveryBind() {
    document.getElementById('delFilter').addEventListener('change', e => { this.delFilter = e.target.value; this.render(); });
    document.querySelectorAll('[data-open-order]').forEach(el => {
      el.addEventListener('click', () => this.openOrder(Number(el.dataset.openOrder)));
    });
  },

  // ---------------- REPORTES ----------------
  reportsHTML() {
    const to = new Date();
    const from = new Date();
    from.setDate(to.getDate() - 6);
    const iso = d => d.toISOString().slice(0, 10);
    if (!this.reportFrom) this.reportFrom = iso(from);
    if (!this.reportTo) this.reportTo = iso(to);
    return `
      <div class="panel-head">
        <h2><i class="fa-solid fa-chart-line"></i> Reportes de ventas</h2>
        <div class="toolbar" style="margin:0">
          <div class="field" style="flex-direction:row;align-items:center;gap:8px"><label>Desde</label><input type="date" id="rFrom" value="${this.reportFrom}" class="select"></div>
          <div class="field" style="flex-direction:row;align-items:center;gap:8px"><label>Hasta</label><input type="date" id="rTo" value="${this.reportTo}" class="select"></div>
          <select class="select" id="rGroup">
            <option value="day" ${this.reportGroup === 'day' ? 'selected' : ''}>Por día</option>
            <option value="category" ${this.reportGroup === 'category' ? 'selected' : ''}>Por categoría</option>
            <option value="product" ${this.reportGroup === 'product' ? 'selected' : ''}>Top productos</option>
          </select>
          <button class="btn btn-outline" id="rExport"><i class="fa-solid fa-file-csv"></i> Exportar CSV</button>
        </div>
      </div>
      <div id="reportResults"></div>
    `;
  },

  reportBind() {
    const bind = () => {
      document.getElementById('rFrom').addEventListener('change', e => { this.reportFrom = e.target.value; this.evalReport(); });
      document.getElementById('rTo').addEventListener('change', e => { this.reportTo = e.target.value; this.evalReport(); });
      document.getElementById('rGroup').addEventListener('change', e => { this.reportGroup = e.target.value; this.evalReport(); });
      document.getElementById('rExport').addEventListener('click', () => this.exportCSV());
    };
    if (document.getElementById('rFrom')) bind();
  },

  async evalReport() {
    const el = document.getElementById('reportResults');
    if (!el) return;
    el.innerHTML = '<div class="muted" style="padding:20px"><i class="fa-solid fa-spinner fa-spin"></i> Calculando...</div>';
    try {
      const url = `/api/reports/sales?group=${this.reportGroup}&from=${this.reportFrom}&to=${this.reportTo}`;
      const rows = await API.get(url);
      if (this.reportGroup === 'day') this.renderDayReport(rows, el);
      else this.renderBreakdown(rows, el);
    } catch (e) {
      el.innerHTML = `<div class="muted" style="padding:20px">${esc(e.message)}</div>`;
    }
  },

  renderDayReport(rows, el) {
    const totalRevenue = rows.reduce((a, r) => a + r.revenue, 0);
    const totalOrders = rows.reduce((a, r) => a + r.orders, 0);
    const max = Math.max(1, ...rows.map(r => r.revenue));
    const bars = rows.map((r, i) => {
      const h = Math.round(r.revenue / max * 100);
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;min-width:0">
        <span style="font-size:.72rem;font-weight:700">${money(r.revenue)}</span>
        <div style="width:100%;height:200px;display:flex;align-items:flex-end;background:#faf9f6;border-radius:8px;overflow:hidden">
          <div class="bar-fill" style="width:100%;height:${h}%;min-height:0"></div>
        </div>
        <span style="font-size:.76rem;color:var(--muted);white-space:nowrap">${esc(r.label)}</span>
        <span style="font-size:.72rem;color:var(--muted)">${r.orders} ped.</span>
      </div>`;
    }).join('');
    el.innerHTML = `
      <div class="stat-cards">
        <div class="stat-card accent"><div class="lbl">Ingresos (rango)</div><div class="num">${money(totalRevenue)}</div></div>
        <div class="stat-card"><div class="lbl">Pedidos (rango)</div><div class="num">${totalOrders}</div></div>
        <div class="stat-card ok"><div class="lbl">Ticket promedio</div><div class="num">${money(totalOrders ? totalRevenue / totalOrders : 0)}</div></div>
      </div>
      <div class="panel-card">
        <h3><i class="fa-solid fa-calendar-days"></i> Ventas por día</h3>
        <div style="display:flex;gap:12px;align-items:flex-end;min-height:260px">${bars || '<span class="muted">Sin ventas en el rango.</span>'}</div>
      </div>
    `;
  },

  renderBreakdown(rows, el) {
    const colors = ['#f59e0b', '#0f172a', '#b45309', '#1d4ed8', '#15803d', '#9333ea', '#be123c', '#3f3f46'];
    const total = rows.reduce((a, r) => a + r.revenue, 0);
    const max = Math.max(1, ...rows.map(r => r.units));
    el.innerHTML = `
      <div class="two-col">
        <div class="panel-card">
          <h3><i class="fa-solid fa-rectangle-list"></i> ${this.reportGroup === 'category' ? 'Por categoría' : 'Top productos'}</h3>
          <div class="bars">
            ${rows.length ? rows.slice(0, 12).map((r, i) => `
              <div class="bar-row">
                <span style="font-weight:600;overflow:hidden;text-overflow:ellipsis" title="${esc(r.label)}">${esc(r.label)}</span>
                <div class="bar-track"><div class="bar-fill" style="width:${Math.round(r.units / max * 100)}%"></div></div>
                <span>${r.units} uds</span>
              </div>`).join('') : '<span class="muted">Sin datos en el rango.</span>'}
          </div>
        </div>
        <div class="panel-card">
          <h3><i class="fa-solid fa-chart-pie"></i> Participación por ingresos</h3>
          ${rows.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px">
              ${rows.slice(0, 8).map((r, i) => `
                <span style="display:inline-flex;align-items:center;gap:6px;font-size:.8rem;font-weight:600;background:var(--bg);border-radius:999px;padding:6px 12px">
                  <i style="width:11px;height:11px;border-radius:3px;background:${colors[i % colors.length]};display:inline-block"></i>
                  ${esc(r.label)} · ${Math.round(r.revenue / total * 100)}% · <span style="color:var(--muted)">${money(r.revenue)}</span>
                </span>`).join('')}
            </div>` : ''}
          <div class="chart-wrap">
            <canvas id="pieChart"></canvas>
          </div>
        </div>
      </div>
    `;
    this.drawPie(rows.slice(0, 8), colors);
  },

  drawPie(rows, colors) {
    const canvas = document.getElementById('pieChart');
    const wrap = canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = wrap.clientWidth, h = 240;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 14;
    const total = rows.reduce((a, r) => a + r.revenue, 0);
    if (!total) { ctx.fillStyle = '#6b6f76'; ctx.textAlign = 'center'; ctx.fillText('Sin ventas', cx, cy); return; }
    let angle = -Math.PI / 2;
    rows.forEach((r, i) => {
      const a = r.revenue / total * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, R, angle, angle + a);
      ctx.closePath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.fill();
      angle += a;
    });
    ctx.beginPath();
    ctx.arc(cx, cy, R * 0.55, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.fillStyle = '#17181c';
    ctx.textAlign = 'center';
    ctx.font = '800 20px Segoe UI';
    ctx.fillText(money(total), cx, cy - 4);
    ctx.font = '600 12px Segoe UI';
    ctx.fillStyle = '#6b6f76';
    ctx.fillText('total', cx, cy + 16);
  },

  exportCSV() {
    const headers = this.reportGroup === 'day' ? 'fecha,pedidos,ingresos' : 'concepto,unidades,ingresos';
    const url = `/api/reports/sales?group=${this.reportGroup}&from=${this.reportFrom}&to=${this.reportTo}`;
    API.get(url).then(rows => {
      const lines = [headers, ...rows.map(r => this.reportGroup === 'day'
        ? `${r.label},${r.orders},${r.revenue}`
        : `"${String(r.label).replace(/"/g, '""')}",${r.units},${r.revenue}`)];
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `reporte-ventas-${this.reportFrom}-${this.reportTo}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Reporte exportado');
    }).catch(e => toast(e.message, 'err'));
  }
};