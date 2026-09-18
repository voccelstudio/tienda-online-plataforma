/* Base de datos local (localStorage) para GitHub Pages.
   Imita exactamente los endpoints del backend Express para que
   store.js y admin.js funcionen sin cambios. v2: descuentos,
   movimientos de stock, antiguedad y reportes mensuales. */
const LocalDB = (() => {
const KEY = 'voccela.db.v4';
const SHIPPING = 20000;

const IMAGE_BY_NAME = {
  'Camiseta Urban Básica': 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop',
  'Hoodie VOCCEL Classic': 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop',
  'Jean Slim Fit Destroyed': 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop',
  'Chamarra Bomber Negra': 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop',
  'Polo Deportiva Corte Clásico': 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=800&auto=format&fit=crop',
  'Pantalón Cargo Táctico': 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?q=80&w=800&auto=format&fit=crop',
  'Chaleco Acolchado Ligero': 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?q=80&w=800&auto=format&fit=crop',
  'Sudadera Oversize Canguro': 'https://images.unsplash.com/photo-1509942774463-acf339cf87d5?q=80&w=800&auto=format&fit=crop',
  'Camisa Oxford Formal': 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop',
  'Leggings Deportivos Alta Compresión': 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?q=80&w=800&auto=format&fit=crop'
};
  const ORDER_STATUSES = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado', 'expirado'];
  const DELIVERY_STATUSES = ['pendiente', 'en_reparto', 'entregado', 'devuelto'];
  const DISCOUNT_OPTIONS = [0, 10, 20, 30, 40];

  const DEFAULT_SETTINGS = {
    store_name: 'VOCCEL',
    whatsapp: '+595981000000',
    delivery_fee: 20000,
    free_delivery_over: 0,
    iva: 0,
    iva_calc: 'incluido',
    payment_methods: { efectivo: true, transferencia: true, qr: true },
    transfer_info: 'Transferencia bancaria: Banco Pyme · Cta. 12345678 · Titular: VOCCEL S.A.',
    qr_info: 'Te enviamos el QR y alias de pago al confirmar el pedido.',
    pickup_points: [{ name: 'Tienda VOCCEL', address: 'Av. Principal 123, Asunción', hours: 'Lun-Sáb 9:00 - 19:00' }],
    pickup_slots: ['09:00 - 12:00', '14:00 - 17:00', '17:00 - 19:00'],
    pending_expire_days: 0
  };
  function settingsJSON() {
    const s = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
    return { store_name: s.store_name, whatsapp: s.whatsapp, delivery_fee: s.delivery_fee, free_delivery_over: s.free_delivery_over, iva: s.iva, iva_calc: s.iva_calc, payment_methods: s.payment_methods, transfer_info: s.transfer_info, qr_info: s.qr_info, pickup_points: s.pickup_points || [], pickup_slots: s.pickup_slots || [], pending_expire_days: s.pending_expire_days };
  }
  function fmtGs(n) { return 'Gs. ' + Math.round(n || 0).toLocaleString('es-PY'); }
  function validateCoupon(code, subtotal) {
    if (!code) return null;
    const c = (db.coupons || []).find(x => x.code.toLowerCase() === String(code).trim().toLowerCase());
    if (!c || !c.active) throwErr('Cupón no válido');
    if (c.max_uses && (c.uses || 0) >= c.max_uses) throwErr('Cupón agotado');
    if (c.min_purchase && subtotal < c.min_purchase) throwErr('El cupón requiere un mínimo de ' + fmtGs(c.min_purchase));
    const discount = c.type === 'percent'
      ? Math.round(subtotal * Math.min(100, c.value) / 100)
      : Math.min(subtotal, c.value);
    return { code: c.code, discount, coupon_id: c.id, percent: c.type === 'percent' ? c.value : null };
  }
  function ts(dt) { const t = new Date((dt || '').replace(' ', 'T')); return isNaN(t.getTime()) ? 0 : t.getTime(); }
  function housekeeping() {
    const days = Number((db.settings || {}).pending_expire_days) || 0;
    let changed = false;
    if (days > 0) {
      const limit = Date.now() - days * 86400000;
      for (const s of db.sales) {
        if ((s.status === 'pendiente' || s.status === 'confirmado') && ts(s.created_at) && ts(s.created_at) < limit) { s.status = 'expirado'; changed = true; }
      }
    }
    if (changed) save(db);
  }

  const SEED_PRODUCTS = [
    { name: 'Camiseta Urban Básica', category: 'Camisetas', list_price: 199000, image: IMAGE_BY_NAME['Camiseta Urban Básica'], description: 'Camiseta de algodón 100% peinado, corte slim. Básica de todos los días.' },
    { name: 'Hoodie VOCCEL Classic', category: 'Sudaderas', list_price: 449000, image: IMAGE_BY_NAME['Hoodie VOCCEL Classic'], description: 'Sudadera con capucha de felpa francesa, interior cepillado y capucha de doble capa.' },
    { name: 'Jean Slim Fit Destroyed', category: 'Pantalones', list_price: 549000, image: IMAGE_BY_NAME['Jean Slim Fit Destroyed'], description: 'Jean slim fit con desgastes, mezclilla elástica cómoda para todo el día.' },
    { name: 'Chamarra Bomber Negra', category: 'Chaquetas', list_price: 749000, image: IMAGE_BY_NAME['Chamarra Bomber Negra'], description: 'Chamarra bomber con forro acolchado, bolsillos con cremallera y puños de punto.' },
    { name: 'Polo Deportiva Corte Clásico', category: 'Camisetas', list_price: 279000, image: IMAGE_BY_NAME['Polo Deportiva Corte Clásico'], description: 'Polo de piqué transpirable, cuello estructurado y botonadura de 3 botones.' },
    { name: 'Pantalón Cargo Táctico', category: 'Pantalones', list_price: 499000, image: IMAGE_BY_NAME['Pantalón Cargo Táctico'], description: 'Cargo de 6 bolsillos, tela de ripstop resistente y cintura ajustable.' },
    { name: 'Chaleco Acolchado Ligero', category: 'Chaquetas', list_price: 649000, image: IMAGE_BY_NAME['Chaleco Acolchado Ligero'], description: 'Chaleco sin mangas ultraligero, ideal para capas en días frescos.' },
    { name: 'Sudadera Oversize Canguro', category: 'Sudaderas', list_price: 419000, image: IMAGE_BY_NAME['Sudadera Oversize Canguro'], description: 'Sudadera oversize con bolsillo canguro y algodón hilado grueso. Fit holgado.' },
    { name: 'Camisa Oxford Formal', category: 'Camisetas', list_price: 359000, image: IMAGE_BY_NAME['Camisa Oxford Formal'], description: 'Camisa oxford de botonadura completa, tela de algodón oxford clásica.' },
    { name: 'Leggings Deportivos Alta Compresión', category: 'Deportivo', list_price: 319000, image: IMAGE_BY_NAME['Leggings Deportivos Alta Compresión'], description: 'Leggings de alta compresión con cintura alta y tela de secado rápido.' }
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
        if (db.v >= 4) return db;
        // migracion v1/v2/v3 -> v4
        if (db.v < 2) {
          db.nextMoveId = db.nextMoveId || 1;
          db.movements = db.movements || [];
          (db.products || []).forEach(p => {
            if (p.discount === undefined) p.discount = 0;
            if (!p.list_price) p.list_price = p.price;
          });
          (db.sizes || []).forEach(s => { if (!s.last_inbound) s.last_inbound = now(); });
          try { localStorage.removeItem('voccela.db.v1'); } catch (e) {}
        }
        // conversion aproximada USD -> PYG
        const FACTOR = 7300;
        (db.products || []).forEach(p => {
          if (p.price > 0 && p.price < 10000) {
            p.list_price = Math.round((p.list_price || p.price) * FACTOR);
            p.price = Math.round(p.price * FACTOR);
          }
        });
        (db.sale_items || []).forEach(it => { it.unit_price = Math.round(it.unit_price * FACTOR); });
        (db.sales || []).forEach(s => { s.subtotal = Math.round(s.subtotal * FACTOR); s.total = Math.round(s.total * FACTOR); });
        (db.sizes || []).forEach(s => { if (!s.last_inbound) s.last_inbound = now(); });
        // imagenes de stock de ropa en vez de placeholders
        (db.products || []).forEach(p => {
          if ((p.image || '').includes('placehold.co') && IMAGE_BY_NAME[p.name]) p.image = IMAGE_BY_NAME[p.name];
        });
        db.v = 4;
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
  db.settings = Object.assign({}, DEFAULT_SETTINGS, db.settings || {});
  db.coupons = db.coupons || [];
  db.nextCouponId = db.nextCouponId || 1;
  save(db);
  housekeeping();

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
      const s = db.settings;
      let subtotal = 0;
      const detail = [];
      for (const it of body.items) {
        const pid = Number(it.product_id);
        const size = String(it.size || '').trim();
        const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
        const prod = db.products.find(x => x.id === pid && x.active);
        if (!prod) throwErr(`Producto #${pid} no disponible`);
        if (!size) throwErr(`Faltó seleccionar talla de ${prod.name}`);
        const row = db.sizes.find(x => x.product_id === pid && x.size === size);
        const available = row ? row.stock : 0;
        if (!row || available < qty) throwErr(`Stock insuficiente para "${prod.name}" talla ${size}. Disponible: ${available}`);
        detail.push({ prod, size, qty });
        subtotal += effPrice(prod) * qty;
      }
      subtotal = Math.round(subtotal * 100) / 100;
      const couponInfo = body.coupon ? validateCoupon(body.coupon, subtotal) : null;
      const couponDiscount = couponInfo ? couponInfo.discount : 0;
      const net = subtotal - couponDiscount;
      const isRetiro = body.delivery_method === 'retiro';
      let shippingFee = 0;
      if (!isRetiro) {
        shippingFee = (Number(s.free_delivery_over) > 0 && net >= Number(s.free_delivery_over)) ? 0 : Number(s.delivery_fee);
      }
      const taxAmount = Number(s.iva) > 0 && s.iva_calc === 'extra' ? Math.round(net * Number(s.iva) / 100) : 0;
      const total = Math.round((net + shippingFee + taxAmount) * 100) / 100;
      const paymentMethod = ['efectivo', 'transferencia', 'qr'].includes(body.payment_method) ? body.payment_method : 'efectivo';
      const pickupDate = body.pickup_date || (body.pickup_day ? `${body.pickup_day} ${body.pickup_slot || ''}`.trim() : '');
      const saleId = db.nextSaleId++;
      db.sales.push({ id: saleId, customer_name: body.customer_name, customer_phone: body.customer_phone || '', customer_email: body.customer_email || '', address: isRetiro ? '' : (body.address || ''), delivery_method: body.delivery_method || 'envio', shipping_fee: shippingFee, status: 'pendiente', subtotal, total, notes: body.notes || '', pickup_date: pickupDate, delivery_date: body.delivery_date || '', pickup_point: isRetiro ? (body.pickup_point || '') : '', payment_method: paymentMethod, payment_ref: body.payment_ref || '', payment_status: paymentMethod === 'efectivo' ? 'pendiente' : 'pendiente', coupon_code: couponInfo ? couponInfo.code : '', coupon_discount: couponDiscount, tax_amount: taxAmount, created_at: now() });
      for (const d of detail) {
        db.sale_items.push({ sale_id: saleId, product_id: d.prod.id, product_name: d.prod.name, size: d.size, quantity: d.qty, unit_price: effPrice(d.prod) });
        db.sizes.find(x => x.product_id === d.prod.id && x.size === d.size).stock -= d.qty;
        logMove(d.prod.id, d.size, 'salida', d.qty, `Venta pedido #${saleId}`);
      }
      if (couponInfo) {
        const c = db.coupons.find(x => x.id === couponInfo.coupon_id);
        if (c) { c.uses = (c.uses || 0) + 1; }
      }
      if (!isRetiro) {
        db.deliveries.push({ sale_id: saleId, courier: '', tracking_number: '', status: 'pendiente', estimated_date: '', delivered_at: '' });
      }
      save(db);
      return { ok: true, sale_id: saleId, subtotal, shipping_fee: shippingFee, tax_amount: taxAmount, coupon_discount: couponDiscount, total, message: 'Pedido registrado. Se actualizó el inventario automáticamente.' };
    }

    // SETTINGS
    if (method === 'GET' && path === '/api/settings') return settingsJSON();
    if (method === 'PUT' && path === '/api/settings') {
      const s = Object.assign({}, DEFAULT_SETTINGS, db.settings || {}, body || {});
      db.settings = s;
      save(db);
      return settingsJSON();
    }

    // COUPONS
    if (method === 'GET' && path === '/api/coupons') return db.coupons;
    if (method === 'GET' && path === '/api/coupons/validate') {
      const c = validateCoupon(q.get('code'), Number(q.get('subtotal')) || 0);
      return { ok: true, code: c.code, discount: c.discount, percent: c.percent };
    }
    if (method === 'POST' && path === '/api/coupons') {
      if (!body || !body.code) throwErr('Falta el código del cupón');
      const id = db.nextCouponId++;
      const c = { id, code: String(body.code).trim().toUpperCase(), type: body.type === 'fixed' ? 'fixed' : 'percent', value: Math.max(0, Number(body.value) || 0), min_purchase: Number(body.min_purchase) || 0, max_uses: Number(body.max_uses) || 0, uses: 0, active: body.active !== false, created_at: now() };
      db.coupons.push(c);
      save(db);
      return c;
    }
    let cm = path.match(/^\/api\/coupons\/(\d+)$/);
    if (cm && (method === 'PUT' || method === 'DELETE')) {
      const c = db.coupons.find(x => x.id === Number(cm[1]));
      if (!c) throwErr('Cupón no encontrado');
      if (method === 'DELETE') { db.coupons = db.coupons.filter(x => x.id !== c.id); save(db); return { ok: true }; }
      if (body.code !== undefined) c.code = String(body.code).trim().toUpperCase();
      if (body.type !== undefined) c.type = body.type === 'fixed' ? 'fixed' : 'percent';
      if (body.value !== undefined) c.value = Math.max(0, Number(body.value) || 0);
      if (body.min_purchase !== undefined) c.min_purchase = Number(body.min_purchase) || 0;
      if (body.max_uses !== undefined) c.max_uses = Number(body.max_uses) || 0;
      if (body.active !== undefined) c.active = !!body.active;
      save(db);
      return c;
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
      let list = db.sales.map(s => saleJSON(s.id)).sort((a, b) => b.id - a.id);
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
      if (b.pickup_date !== undefined) o.pickup_date = b.pickup_date;
      if (b.delivery_date !== undefined) o.delivery_date = b.delivery_date;
      if (b.shipping_fee !== undefined) o.shipping_fee = b.shipping_fee;
      if (b.payment_status !== undefined) o.payment_status = b.payment_status === 'pagado' ? 'pagado' : 'pendiente';
      if (b.payment_ref !== undefined) o.payment_ref = b.payment_ref;
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