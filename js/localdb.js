/* Base de datos local (localStorage) para GitHub Pages.
   Imita exactamente los endpoints del backend Express para que
   store.js y admin.js funcionen sin cambios. v2: descuentos,
   movimientos de stock, antiguedad y reportes mensuales. */
const LocalDB = (() => {
  const KEY = 'voccela.db.v2';
  const SHIPPING = 5.0;
  const ORDER_STATUSES = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
  const DELIVERY_STATUSES = ['pendiente', 'en_reparto', 'entregado', 'devuelto'];
  const DISCOUNT_OPTIONS = [0, 10, 20, 30, 40];

  const SEED_PRODUCTS = [
    { name: 'Camiseta Urban Básica', category: 'Camisetas', list_price: 19.99, image: 'https://placehold.co/600x800/1f2937/ffffff?text=Camiseta', description: 'Camiseta de algodón 100% peinado, corte slim. Básica de todos los días.' },
    { name: 'Hoodie VOCCEL Classic', category: 'Sudaderas', list_price: 49.99, image: 'https://placehold.co/600x800/0f172a/ffffff?text=Hoodie', description: 'Sudadera con capucha de felpa francesa, interior cepillado y capucha de doble capa.' },
    { name: 'Jean Slim Fit Destroyed', category: 'Pantalones', list_price: 59.99, image: 'https://placehold.co/600x800/1e3a8a/ffffff?text=Jean', description: 'Jean slim fit con desgastes, mezclilla elástica cómoda para todo el día.' },
    { name: 'Chamarra Bomber Negra', category: 'Chaquetas', list_price: 79.99, image: 'https://placehold.co/600x800/111827/ffffff?text=Bomber', description: 'Chamarra bomber con forro acolchado, bolsillos con cremallera y puños de punto.' },
    { name: 'Polo Deportiva Corte Clásico', category: 'Camisetas', list_price: 29.99, image: 'https://placehold.co/600x800/14532d/ffffff?text=Polo', description: 'Polo de piqué transpirable, cuello estructurado y botonadura de 3 botones.' },
    { name: 'Pantalón Cargo Táctico', category: 'Pantalones', list_price: 54.99, image: 'https://placehold.co/600x800/3f3f46/ffffff?text=Cargo', description: 'Cargo de 6 bolsillos, tela de ripstop resistente y cintura ajustable.' },
    { name: 'Chaleco Acolchado Ligero', category: 'Chaquetas', list_price: 69.99, image: 'https://placehold.co/600x800/334155/ffffff?text=Chaleco', description: 'Chaleco sin mangas ultraligero, ideal para capas en días frescos.' },
    { name: 'Sudadera Oversize Canguro', category: 'Sudaderas', list_price: 45.99, image: 'https://placehold.co/600x800/4c1d95/ffffff?text=Oversize', description: 'Sudadera oversize con bolsillo canguro y algodón hilado grueso. Fit holgado.' },
    { name: 'Camisa Oxford Formal', category: 'Camisetas', list_price: 39.99, image: 'https://placehold.co/600x800/7f1d1d/ffffff?text=Oxford', description: 'Camisa oxford de botonadura completa, tela de algodón oxford clásica.' },
    { name: 'Leggings Deportivos Alta Compresión', category: 'Deportivo', list_price: 34.99, image: 'https://placehold.co/600x800/155e75/ffffff?text=Leggings', description: 'Leggings de alta compresión con cintura alta y tela de secado rápido.' }
  ];
  const SIZES = ['S', 'M', 'L', 'XL'];

  function now() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }
  function today() { return now().slice(0, 10); }
  function daysBetween(dateStr) {
    if (!dateStr) return 0;
    const t = new Date(dateStr.replace(' ', 'T'));
    if (isNaN(t.getTime())) return 0;
    return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000));
  }
  function effPrice(p) {
    const d = Math.max(0, Math.min(40, Number(p.discount) || 0));
    return Math.round((p.list_price || p.price || 0) * (1 - d / 100) * 100) / 100;
  }

  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {}
  }

  function load() {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) {}
    if (!raw) { try { raw = localStorage.getItem('voccela.db.v1'); } catch (e) {} }
    if (raw) {
      try {
        const db = JSON.parse(raw);
        if (db.v >= 2) return db;
        // migracion v1 -> v2
        db.v = 2;
        db.nextMoveId = db.nextMoveId || 1;
        db.movements = db.movements || [];
        (db.products || []).forEach(p => {
          if (p.discount === undefined) p.discount = 0;
          if (!p.list_price) p.list_price = p.price;
        });
        (db.sizes || []).forEach(s => { if (!s.last_inbound) s.last_inbound = now(); });
        try { localStorage.removeItem('voccela.db.v1'); } catch (e) {}
        save(db);
        return db;
      } catch (e) {}
    }
    const db = { v: 2, products: [], sizes: [], sales: [], sale_items: [], deliveries: [], movements: [], nextProductId: 1, nextSaleId: 1, nextMoveId: 1 };
    const created = now();
    SEED_PRODUCTS.forEach((p, idx) => {
      const id = db.nextProductId++;
      db.products.push({ id, name: p.name, description: p.description, category: p.category, list_price: p.list_price, price: p.list_price, discount: 0, image: p.image, active: true, created_at: created });
      SIZES.forEach((s, si) => {
        let stock = 8 + ((idx * 3 + si * 5) % 25);
        if ((idx + si) % 7 === 0) stock = 0;
        if (idx === 3 && si === 0) stock = 0;
        db.sizes.push({ product_id: id, size: s, stock, last_inbound: created });
        if (stock > 0) db.movements.push({ id: db.nextMoveId++, product_id: id, size: s, type: 'entrada', qty: stock, note: 'Carga inicial', created_at: created });
      });
    });
    save(db);
    return db;
  }

  const db = load();

  function getSizes(productId) {
    const rank = { S: 1, M: 2, L: 3, XL: 4 };
    return db.sizes.filter(s => s.product_id === productId)
      .sort((a, b) => (rank[a.size] || 99) - (rank[b.size] || 99))
      .map(s => ({ size: s.size, stock: s.stock, last_inbound: s.last_inbound || null, age_days: daysBetween(s.last_inbound) }));
  }

  function productJSON(p) {
    return { id: p.id, name: p.name, description: p.description, category: p.category, list_price: p.list_price, price: effPrice(p), discount: p.discount || 0, image: p.image, active: !!p.active, sizes: getSizes(p.id) };
  }

  function saleJSON(id) {
    const s = db.sales.find(x => x.id === id);
    if (!s) return null;
    return { ...s, items: db.sale_items.filter(i => i.sale_id === id), delivery: db.deliveries.find(d => d.sale_id === id) || null };
  }

  function logMove(productId, size, type, qty, note) {
    db.movements.push({ id: db.nextMoveId++, product_id: productId, size, type, qty, note: note || '', created_at: now() });
  }
  function moveTypeLabel(t) { return { entrada: 'entrada', salida: 'salida', ajuste: 'ajuste', devolucion: 'devolucion' }[t] || t; }

  function syncSizes(pid, newSizes) {
    for (const s of newSizes) {
      if (!s.size || s.size === '') continue;
      const row = db.sizes.find(x => x.product_id === pid && x.size === s.size);
      const next = Math.max(0, Number(s.stock) || 0);
      if (row) {
        const delta = next - row.stock;
        if (delta !== 0) {
          if (delta > 0) { row.stock = next; row.last_inbound = now(); logMove(pid, row.size, 'entrada', delta, 'Ajuste manual'); }
          else { row.stock = next; logMove(pid, row.size, 'salida', -delta, 'Ajuste manual'); }
        }
      } else if (next > 0) {
        db.sizes.push({ product_id: pid, size: String(s.size), stock: next, last_inbound: now() });
        logMove(pid, String(s.size), 'entrada', next, 'Ajuste manual');
      }
    }
  }

  function throwErr(msg) { const e = new Error(msg); e.local = true; throw e; }

  /* ---------- Rutas ---------- */
  function handle(method, url, body) {
    const path = url.split('?')[0];
    const q = new URLSearchParams(url.split('?')[1] || '');
    const u = url;

    // PRODUCTS
    if (method === 'GET' && u === '/api/products') {
      const admin = q.get('admin') === '1';
      return db.products.filter(p => admin || p.active).map(productJSON);
    }
    let m = path.match(/^\/api\/products\/(\d+)$/);
    if (method === 'GET' && m) {
      const p = db.products.find(x => x.id === Number(m[1]));
      if (!p) throwErr('Producto no encontrado');
      return productJSON(p);
    }
    if (method === 'POST' && path === '/api/products') {
      if (!body || !body.name || body.price === undefined && body.list_price === undefined) throwErr('name y precio son obligatorios');
      const listPrice = Number(body.list_price !== undefined ? body.list_price : body.price);
      const discount = DISCOUNT_OPTIONS.includes(Number(body.discount)) ? Number(body.discount) : 0;
      if (isNaN(listPrice)) throwErr('No es válido el precio de lista');
      const id = db.nextProductId++;
      db.products.push({ id, name: body.name, description: body.description || '', category: body.category || 'Ropa', list_price: listPrice, price: Math.round(listPrice * (1 - discount / 100) * 100) / 100, discount, image: body.image || '', active: true, created_at: now() });
      for (const s of (body.sizes || [])) {
        if (s.size) {
          const stock = Math.max(0, Number(s.stock) || 0);
          db.sizes.push({ product_id: id, size: String(s.size), stock, last_inbound: now() });
          if (stock > 0) logMove(id, String(s.size), 'entrada', stock, 'Carga inicial');
        }
      }
      save(db);
      return productJSON(db.products.find(x => x.id === id));
    }
    if (method === 'PUT' && m) {
      const p = db.products.find(x => x.id === Number(m[1]));
      if (!p) throwErr('Producto no encontrado');
      if (body.name !== undefined) p.name = body.name;
      if (body.description !== undefined) p.description = body.description;
      if (body.category !== undefined) p.category = body.category;
      if (body.image !== undefined) p.image = body.image;
      if (body.active !== undefined) p.active = !!body.active;
      if (body.discount !== undefined) p.discount = DISCOUNT_OPTIONS.includes(Number(body.discount)) ? Number(body.discount) : p.discount;
      if (body.list_price !== undefined) p.list_price = Number(body.list_price);
      p.price = effPrice(p);
      if (Array.isArray(body.sizes)) syncSizes(p.id, body.sizes);
      save(db);
      return productJSON(p);
    }
    if (method === 'DELETE' && m) {
      const i = db.products.findIndex(x => x.id === Number(m[1]));
      if (i < 0) throwErr('Producto no encontrado');
      db.products.splice(i, 1);
      db.sizes = db.sizes.filter(s => s.product_id !== Number(m[1]));
      save(db);
      return { ok: true };
    }

    // CHECKOUT
    if (method === 'POST' && path === '/api/checkout') {
      if (!body || !body.customer_name) throwErr('customer_name es obligatorio');
      if (!Array.isArray(body.items) || !body.items.length) throwErr('El carrito está vacío');
      const shippingFee = body.delivery_method === 'retiro' ? 0 : SHIPPING;
      let subtotal = 0;
      const detail = [];
      for (const it of body.items) {
        const pid = Number(it.product_id);
        const size = String(it.size || '').trim();
        const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const prod = db.products.find(x => x.id === pid && x.active);
        if (!prod) throwErr(`Producto #${pid} no disponible`);
        if (!size) throwErr(`Faltó seleccionar talla de ${prod.name}`);
        const row = db.sizes.find(s => s.product_id === pid && s.size === size);
        const available = row ? row.stock : 0;
        if (!row || available < qty) throwErr(`Stock insuficiente para "${prod.name}" talla ${size}. Disponible: ${available}`);
        detail.push({ prod, size, qty });
        subtotal += effPrice(prod) * qty;
      }
      const total = Math.round((subtotal + shippingFee) * 100) / 100;
      const saleId = db.nextSaleId++;
      db.sales.push({ id: saleId, customer_name: body.customer_name, customer_phone: body.customer_phone || '', customer_email: body.customer_email || '', address: body.delivery_method === 'retiro' ? '' : (body.address || ''), delivery_method: body.delivery_method || 'envio', shipping_fee: shippingFee, status: 'pendiente', subtotal, total, notes: body.notes || '', created_at: now() });
      for (const d of detail) {
        db.sale_items.push({ sale_id: saleId, product_id: d.prod.id, product_name: d.prod.name, size: d.size, quantity: d.qty, unit_price: effPrice(d.prod) });
        db.sizes.find(s => s.product_id === d.prod.id && s.size === d.size).stock -= d.qty;
        logMove(d.prod.id, d.size, 'salida', d.qty, `Venta pedido #${saleId}`);
      }
      if (body.delivery_method === 'envio') {
        db.deliveries.push({ sale_id: saleId, courier: '', tracking_number: '', status: 'pendiente', estimated_date: '', delivered_at: '' });
      }
      save(db);
      return { ok: true, sale_id: saleId, subtotal, shipping_fee: shippingFee, total, message: 'Pedido registrado. Se actualizó el inventario automáticamente.' };
    }

    // MOVEMENTS (datos de entrada/salida)
    if (method === 'GET' && path === '/api/movements') {
      const type = q.get('type');
      const pid = q.get('product_id');
      let list = [...db.movements].sort((a, b) => b.id - a.id);
      if (type) list = list.filter(x => x.type === type);
      if (pid) list = list.filter(x => String(x.product_id) === pid);
      return list.map(x => ({ ...x, product_name: (db.products.find(p => p.id === x.product_id) || {}).name || 'Eliminado' }));
    }

    // ORDERS
    if (method === 'GET' && u.startsWith('/api/orders') && !path.match(/^\/api\/orders\/\d+$/)) {
      const status = q.get('status');
      const search = q.get('q');
      let list = db.sales.map(saleJSON).sort((a, b) => b.id - a.id);
      if (status && ORDER_STATUSES.includes(status)) list = list.filter(o => o.status === status);
      if (search) {
        const s = search.toLowerCase();
        list = list.filter(o => String(o.id).includes(s) || (o.customer_name || '').toLowerCase().includes(s) || (o.customer_phone || '').toLowerCase().includes(s));
      }
      return list;
    }
    m = path.match(/^\/api\/orders\/(\d+)$/);
    if (method === 'GET' && m) {
      const o = saleJSON(Number(m[1]));
      if (!o) throwErr('Pedido no encontrado');
      return o;
    }
    if (method === 'PUT' && m) {
      const o = db.sales.find(x => x.id === Number(m[1]));
      if (!o) throwErr('Pedido no encontrado');
      const b = body || {};
      if (b.status !== undefined) {
        if (!ORDER_STATUSES.includes(b.status)) throwErr('Status inválido');
        o.status = b.status;
        if (b.status === 'cancelado') {
          const items = db.sale_items.filter(i => i.sale_id === o.id);
          for (const it of items) {
            const row = db.sizes.find(s => s.product_id === it.product_id && s.size === it.size);
            if (row) { row.stock += it.quantity; row.last_inbound = now(); }
            logMove(it.product_id, it.size, 'devolucion', it.quantity, `Cancelación pedido #${o.id}`);
          }
          const del = db.deliveries.find(d => d.sale_id === o.id);
          if (del) del.status = 'devuelto';
        }
      }
      if (b.customer_name !== undefined) o.customer_name = b.customer_name;
      if (b.customer_phone !== undefined) o.customer_phone = b.customer_phone;
      if (b.address !== undefined) o.address = b.address;
      if (b.delivery_method !== undefined) o.delivery_method = b.delivery_method;
      if (b.notes !== undefined) o.notes = b.notes;
      save(db);
      return saleJSON(o.id);
    }

    // DELIVERY
    m = path.match(/^\/api\/delivery\/(\d+)$/);
    if (method === 'PUT' && m) {
      const sale = db.sales.find(x => x.id === Number(m[1]));
      if (!sale) throwErr('Pedido no encontrado');
      if (sale.delivery_method === 'retiro') throwErr('Este pedido es para retiro en tienda');
      let del = db.deliveries.find(d => d.sale_id === sale.id);
      if (!del) { del = { sale_id: sale.id, courier: '', tracking_number: '', status: 'pendiente', estimated_date: '', delivered_at: '' }; db.deliveries.push(del); }
      const b = body || {};
      if (b.courier !== undefined) del.courier = b.courier;
      if (b.tracking_number !== undefined) del.tracking_number = b.tracking_number;
      if (b.estimated_date !== undefined) del.estimated_date = b.estimated_date;
      if (b.status !== undefined) {
        if (!DELIVERY_STATUSES.includes(b.status)) throwErr('Status de delivery inválido');
        del.status = b.status;
        if (b.status === 'entregado' && !del.delivered_at) {
          del.delivered_at = now();
          sale.status = 'entregado';
        }
      }
      save(db);
      return saleJSON(sale.id);
    }

    // STATS
    if (method === 'GET' && path === '/api/stats') {
      const t = today();
      const nonCancelled = db.sales.filter(s => s.status !== 'cancelado');
      const todaySales = nonCancelled.filter(s => (s.created_at || '').startsWith(t));
      const pendingOrders = db.sales.filter(s => ['pendiente', 'confirmado', 'enviado'].includes(s.status)).length;
      const unitsSold = db.sale_items.filter(i => db.sales.find(s => s.id === i.sale_id && s.status !== 'cancelado')).reduce((a, i) => a + i.quantity, 0);
      const inventoryValue = db.sizes.reduce((a, s) => a + s.stock * effPrice(db.products.find(p => p.id === s.product_id) || { list_price: 0 }), 0);
      let lowStock = 0, aging = 0;
      for (const s of db.sizes) {
        const p = db.products.find(x => x.id === s.product_id);
        if (!p || !p.active) continue;
        if (s.stock <= 2) lowStock++;
        if (s.stock > 0 && daysBetween(s.last_inbound) > 30) aging++;
      }
      return { sales_today: todaySales.reduce((a, s) => a + s.total, 0), orders_today: todaySales.length, pending_orders: pendingOrders, active_products: db.products.filter(p => p.active).length, low_stock: lowStock, aging_alerts: aging, units_sold: unitsSold, inventory_value: inventoryValue };
    }

    // INVENTORY
    if (method === 'GET' && path === '/api/inventory') {
      return db.products.map(p => {
        const sizes = getSizes(p.id);
        const sold = db.sale_items.filter(i => i.product_id === p.id && db.sales.find(s => s.id === i.sale_id && s.status !== 'cancelado')).reduce((a, i) => a + i.quantity, 0);
        return { ...productJSON(p), total_stock: sizes.reduce((a, s) => a + s.stock, 0), units_sold: sold };
      });
    }

    // REPORTS
    if (method === 'GET' && path === '/api/reports/sales') {
      const from = q.get('from');
      const to = q.get('to');
      const group = q.get('group') || 'day';
      const inRange = s => {
        if (!from || !to) return true;
        const d = s.created_at || '';
        return d >= (from + ' 00:00:00') && d <= (to + ' 23:59:59');
      };
      const sales = db.sales.filter(s => s.status !== 'cancelado' && inRange(s));
      if (group === 'month') {
        const map = {};
        for (const s of sales) {
          const label = (s.created_at || '').slice(0, 7);
          map[label] = map[label] || { label, orders: 0, revenue: 0, units: 0 };
          map[label].orders++; map[label].revenue += s.total;
          map[label].units += db.sale_items.filter(i => i.sale_id === s.id).reduce((a, i) => a + i.quantity, 0);
        }
        return Object.values(map).sort((a, b) => a.label < b.label ? -1 : 1);
      }
      if (group === 'day') {
        const map = {};
        for (const s of sales) {
          const label = (s.created_at || '').slice(0, 10);
          map[label] = map[label] || { label, orders: 0, revenue: 0 };
          map[label].orders++; map[label].revenue += s.total;
        }
        return Object.values(map).sort((a, b) => a.label < b.label ? -1 : 1);
      }
      const map = {};
      for (const s of sales) {
        const items = db.sale_items.filter(i => i.sale_id === s.id);
        for (const it of items) {
          const prod = db.products.find(p => p.id === it.product_id);
          const label = group === 'category' ? (prod ? prod.category : it.product_name) : it.product_name;
          map[label] = map[label] || { label, units: 0, revenue: 0 };
          map[label].units += it.quantity;
          map[label].revenue += it.quantity * it.unit_price;
        }
      }
      return Object.values(map).sort((a, b) => b.units - a.units);
    }

    throwErr('Ruta no encontrada: ' + method + ' ' + url);
  }

  function reset() {
    localStorage.removeItem(KEY);
    location.reload();
  }

  return { handle, reset };
})();