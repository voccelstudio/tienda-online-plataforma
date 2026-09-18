const express = require('express');
const path = require('node:path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const SHIPPING_FEE_ENVIO = 5.0;
const ORDER_STATUSES = ['pendiente', 'confirmado', 'enviado', 'entregado', 'cancelado'];
const DELIVERY_STATUSES = ['pendiente', 'en_reparto', 'entregado', 'devuelto'];
const DISCOUNT_OPTIONS = [0, 10, 20, 30, 40];

function effPrice(row) {
  const d = Math.max(0, Math.min(40, Number(row.discount) || 0));
  return Math.round((row.list_price || row.price || 0) * (1 - d / 100) * 100) / 100;
}
function ageDays(dateStr) {
  if (!dateStr) return 0;
  const t = new Date(dateStr.replace(' ', 'T'));
  if (isNaN(t.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000));
}
function logMove(productId, size, type, qty, note) {
  db.prepare('INSERT INTO stock_movements (product_id, size, type, qty, note) VALUES (?, ?, ?, ?, ?)')
    .run(productId, size, type, qty, note || '');
}

function productRow(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category,
    list_price: row.list_price,
    price: effPrice(row),
    discount: row.discount || 0,
    image: row.image,
    active: !!row.active
  };
}

function getSizes(productId) {
  return db.prepare(`SELECT size, stock, last_inbound FROM product_sizes WHERE product_id = ? ORDER BY CASE size WHEN 'S' THEN 1 WHEN 'M' THEN 2 WHEN 'L' THEN 3 WHEN 'XL' THEN 4 ELSE 5 END`).all(productId);
}

function sizesWithAge(productId) {
  return getSizes(productId).map(s => ({ size: s.size, stock: s.stock, last_inbound: s.last_inbound || null, age_days: ageDays(s.last_inbound) }));
}

function syncSizes(pid, newSizes) {
  const get = db.prepare('SELECT stock FROM product_sizes WHERE product_id = ? AND size = ?');
  const upd = db.prepare('UPDATE product_sizes SET stock = ?, last_inbound = ? WHERE product_id = ? AND size = ?');
  const ins = db.prepare('INSERT INTO product_sizes (product_id, size, stock, last_inbound) VALUES (?, ?, ?, ?)');
  for (const s of newSizes) {
    if (!s.size || s.size === '') continue;
    const next = Math.max(0, Number(s.stock) || 0);
    const row = get.get(pid, s.size);
    if (row) {
      const delta = next - row.stock;
      if (delta !== 0) {
        if (delta > 0) { upd.run(next, new Date().toISOString(), pid, s.size); logMove(pid, s.size, 'entrada', delta, 'Ajuste manual'); }
        else { upd.run(next, null, pid, s.size); logMove(pid, s.size, 'salida', -delta, 'Ajuste manual'); }
      }
    } else if (next > 0) {
      ins.run(pid, String(s.size), next, new Date().toISOString());
      logMove(pid, String(s.size), 'entrada', next, 'Ajuste manual');
    }
  }
}

// ---------- PRODUCTS ----------

app.get('/api/products', (req, res) => {
  let rows;
  if (req.query.admin === '1') {
    rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  } else {
    rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY id DESC').all();
  }
  res.json(rows.map(r => ({ ...productRow(r), sizes: getSizes(r.id) })));
});

app.get('/api/products/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Producto no encontrado' });
  res.json({ ...productRow(row), sizes: getSizes(row.id) });
});

app.post('/api/products', (req, res) => {
  const { name, description = '', category = 'Ropa', list_price, price, discount, image = '', sizes = [] } = req.body || {};
  const base = Number(list_price !== undefined ? list_price : price);
  if (!name || base === undefined || isNaN(base)) {
    return res.status(400).json({ error: 'name y un precio de lista son obligatorios' });
  }
  const disc = DISCOUNT_OPTIONS.includes(Number(discount)) ? Number(discount) : 0;
  const eff = Math.round(base * (1 - disc / 100) * 100) / 100;
  const ins = db.prepare('INSERT INTO products (name, description, category, list_price, price, discount, image) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const result = ins.run(name, description, category, base, eff, disc, image);
  const pid = result.lastInsertRowid;
  const nowIso = new Date().toISOString();
  const insS = db.prepare('INSERT INTO product_sizes (product_id, size, stock, last_inbound) VALUES (?, ?, ?, ?)');
  for (const s of sizes || []) {
    if (s.size) {
      const stock = Math.max(0, Number(s.stock) || 0);
      insS.run(pid, String(s.size), stock, nowIso);
      if (stock > 0) logMove(pid, String(s.size), 'entrada', stock, 'Carga inicial');
    }
  }
  res.status(201).json({ id: Number(pid), ...productRow(db.prepare('SELECT * FROM products WHERE id = ?').get(pid)) });
});

app.put('/api/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  const b = req.body || {};
  let listPrice = existing.list_price, disc = existing.discount || 0;
  if (b.list_price !== undefined) listPrice = Number(b.list_price);
  if (b.discount !== undefined) disc = DISCOUNT_OPTIONS.includes(Number(b.discount)) ? Number(b.discount) : disc;
  const eff = Math.round(listPrice * (1 - disc / 100) * 100) / 100;
  db.prepare('UPDATE products SET name = ?, description = ?, category = ?, list_price = ?, price = ?, discount = ?, image = ?, active = ? WHERE id = ?')
    .run(
      b.name ?? existing.name,
      b.description ?? existing.description,
      b.category ?? existing.category,
      listPrice,
      eff,
      disc,
      b.image ?? existing.image,
      b.active !== undefined ? (b.active ? 1 : 0) : existing.active,
      existing.id
    );
  if (Array.isArray(b.sizes)) syncSizes(existing.id, b.sizes);
  const fresh = db.prepare('SELECT * FROM products WHERE id = ?').get(existing.id);
  res.json({ ...productRow(fresh), sizes: sizesWithAge(fresh.id) });
});

app.delete('/api/products/:id', (req, res) => {
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Producto no encontrado' });
  db.prepare('DELETE FROM products WHERE id = ?').run(existing.id);
  res.json({ ok: true });
});

// ---------- CHECKOUT (descuenta stock automaticamente) ----------

app.post('/api/checkout', (req, res) => {
  const { customer_name, customer_phone = '', customer_email = '', address = '', delivery_method = 'envio', notes = '', items = [] } = req.body || {};
  if (!customer_name) return res.status(400).json({ error: 'customer_name es obligatorio' });
  if (!Array.isArray(items) || items.length === 0) return res.status(400).json({ error: 'El carrito está vacío' });

  const shippingFee = delivery_method === 'retiro' ? 0 : SHIPPING_FEE_ENVIO;

  try {
    db.exec('BEGIN IMMEDIATE');

    let subtotal = 0;
    const detail = [];
    const insItem = db.prepare('INSERT INTO sale_items (sale_id, product_id, product_name, size, quantity, unit_price) VALUES (?, ?, ?, ?, ?, ?)');
    const getStock = db.prepare('SELECT stock FROM product_sizes WHERE product_id = ? AND size = ?');
    const updStock = db.prepare('UPDATE product_sizes SET stock = stock - ? WHERE product_id = ? AND size = ?');

    for (const it of items) {
      const pid = Number(it.product_id);
      const size = String(it.size || '').trim();
      const qty = Math.max(1, Math.floor(Number(it.quantity) || 1));
      const prod = db.prepare('SELECT id, name, price FROM products WHERE id = ? AND active = 1').get(pid);
      if (!prod) { db.exec('ROLLBACK'); return res.status(400).json({ error: `Producto #${pid} no disponible` }); }
      if (!size) { db.exec('ROLLBACK'); return res.status(400).json({ error: `Faltó seleccionar talla de ${prod.name}` }); }
      const row = getStock.get(pid, size);
      const available = row ? row.stock : 0;
      if (!row || available < qty) {
        db.exec('ROLLBACK');
        return res.status(409).json({
          error: `Stock insuficiente para "${prod.name}" talla ${size}. Disponible: ${available}`
        });
      }
      detail.push({ product: prod, size, qty });
      subtotal += effPrice(prod) * qty;
    }

    const total = subtotal + shippingFee;
    const insSale = db.prepare(`
      INSERT INTO sales (customer_name, customer_phone, customer_email, address, delivery_method, shipping_fee, status, subtotal, total, notes)
      VALUES (?, ?, ?, ?, ?, ?, 'pendiente', ?, ?, ?)
    `);
    const saleRes = insSale.run(customer_name, customer_phone, customer_email, address, delivery_method, shippingFee, subtotal, total, notes);
    const saleId = Number(saleRes.lastInsertRowid);

    for (const d of detail) {
      insItem.run(saleId, d.product.id, d.product.name, d.size, d.qty, effPrice(d.product));
      updStock.run(d.qty, d.product.id, d.size);
      logMove(d.product.id, d.size, 'salida', d.qty, `Venta pedido #${saleId}`);
    }

    if (delivery_method === 'envio') {
      db.prepare('INSERT INTO deliveries (sale_id, status) VALUES (?, ?)').run(saleId, 'pendiente');
    }

    db.exec('COMMIT');

    res.status(201).json({
      ok: true,
      sale_id: saleId,
      subtotal,
      shipping_fee: shippingFee,
      total,
      message: 'Pedido registrado. Se actualizó el inventario automáticamente.'
    });
  } catch (e) {
    db.exec('ROLLBACK');
    res.status(500).json({ error: 'Error procesando el pedido: ' + e.message });
  }
});

// ---------- ORDENES / PEDIDOS ----------

function saleDetail(saleId) {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(saleId);
  if (!sale) return null;
  const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(saleId);
  const delivery = db.prepare('SELECT * FROM deliveries WHERE sale_id = ?').get(saleId) || null;
  return { ...sale, items, delivery };
}

app.get('/api/orders', (req, res) => {
  const { status, q } = req.query;
  let sql = 'SELECT * FROM sales WHERE 1=1';
  const params = [];
  if (status && ORDER_STATUSES.includes(status)) { sql += ' AND status = ?'; params.push(status); }
  if (q) {
    sql += ' AND (customer_name LIKE ? OR id LIKE ? OR customer_phone LIKE ?)';
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => {
    const items = db.prepare('SELECT * FROM sale_items WHERE sale_id = ?').all(r.id);
    const delivery = db.prepare('SELECT * FROM deliveries WHERE sale_id = ?').get(r.id) || null;
    return { ...r, items, delivery };
  }));
});

app.get('/api/orders/:id', (req, res) => {
  const d = saleDetail(req.params.id);
  if (!d) return res.status(404).json({ error: 'Pedido no encontrado' });
  res.json(d);
});

app.put('/api/orders/:id', (req, res) => {
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.id);
  if (!sale) return res.status(404).json({ error: 'Pedido no encontrado' });
  const b = req.body || {};

  if (b.status !== undefined) {
    if (!ORDER_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Status inválido' });
    db.prepare('UPDATE sales SET status = ? WHERE id = ?').run(b.status, sale.id);

    const deliveryExists = db.prepare('SELECT id FROM deliveries WHERE sale_id = ?').get(sale.id);
    if (b.status === 'cancelado' && deliveryExists) {
      // Devolver stock al cancelar (solo si no fue entregado)
      const order = saleDetail(sale.id);
      const restock = db.prepare('UPDATE product_sizes SET stock = stock + ?, last_inbound = ? WHERE product_id = ? AND size = ?');
      for (const it of order.items) {
        restock.run(it.quantity, new Date().toISOString(), it.product_id, it.size);
        logMove(it.product_id, it.size, 'devolucion', it.quantity, `Cancelación pedido #${sale.id}`);
      }
      db.prepare('UPDATE deliveries SET status = ? WHERE sale_id = ?').run('devuelto', sale.id);
    }
  }
  if (b.customer_name !== undefined) db.prepare('UPDATE sales SET customer_name = ? WHERE id = ?').run(b.customer_name, sale.id);
  if (b.customer_phone !== undefined) db.prepare('UPDATE sales SET customer_phone = ? WHERE id = ?').run(b.customer_phone, sale.id);
  if (b.address !== undefined) db.prepare('UPDATE sales SET address = ? WHERE id = ?').run(b.address, sale.id);
  if (b.delivery_method !== undefined) db.prepare('UPDATE sales SET delivery_method = ? WHERE id = ?').run(b.delivery_method, sale.id);
  if (b.notes !== undefined) db.prepare('UPDATE sales SET notes = ? WHERE id = ?').run(b.notes, sale.id);

  res.json(saleDetail(sale.id));
});

// ---------- DELIVERY ----------

app.put('/api/delivery/:saleId', (req, res) => {
  const b = req.body || {};
  const sale = db.prepare('SELECT * FROM sales WHERE id = ?').get(req.params.saleId);
  if (!sale) return res.status(404).json({ error: 'Pedido no encontrado' });
  if (sale.delivery_method === 'retiro') return res.status(400).json({ error: 'Este pedido es para retiro en tienda' });

  let del = db.prepare('SELECT * FROM deliveries WHERE sale_id = ?').get(sale.id);
  if (!del) {
    db.prepare('INSERT INTO deliveries (sale_id, status) VALUES (?, ?)').run(sale.id, 'pendiente');
    del = db.prepare('SELECT * FROM deliveries WHERE sale_id = ?').get(sale.id);
  }
  const updates = [];
  const params = [];
  if (b.courier !== undefined) { updates.push('courier = ?'); params.push(b.courier); }
  if (b.tracking_number !== undefined) { updates.push('tracking_number = ?'); params.push(b.tracking_number); }
  if (b.estimated_date !== undefined) { updates.push('estimated_date = ?'); params.push(b.estimated_date); }
  if (b.status !== undefined) {
    if (!DELIVERY_STATUSES.includes(b.status)) return res.status(400).json({ error: 'Status de delivery inválido' });
    updates.push('status = ?'); params.push(b.status);
    if (b.status === 'entregado' && !del.delivered_at) {
      updates.push("delivered_at = datetime('now')");
      db.prepare("UPDATE sales SET status = 'entregado' WHERE id = ?").run(sale.id);
    }
  }
  if (updates.length) {
    params.push(sale.id);
    db.prepare(`UPDATE deliveries SET ${updates.join(', ')} WHERE sale_id = ?`).run(...params);
  }
  res.json(saleDetail(sale.id));
});

// ---------- MOVEMENTS (datos de entrada/salida) ----------

app.get('/api/movements', (req, res) => {
  const { type, product_id } = req.query;
  let sql = 'SELECT * FROM stock_movements WHERE 1=1';
  const params = [];
  if (type) { sql += ' AND type = ?'; params.push(type); }
  if (product_id) { sql += ' AND product_id = ?'; params.push(product_id); }
  sql += ' ORDER BY id DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows.map(r => ({
    ...r,
    product_name: (db.prepare('SELECT name FROM products WHERE id = ?').get(r.product_id) || {}).name || 'Eliminado'
  })));
});

// ---------- ESTADISTICAS / REPORTES ----------

app.get('/api/stats', (req, res) => {
  const today = db.prepare("SELECT COALESCE(SUM(total),0) AS total, COUNT(*) AS count FROM sales WHERE created_at >= date('now') AND status != 'cancelado'").get();
  const pending = db.prepare("SELECT COUNT(*) AS count FROM sales WHERE status IN ('pendiente','confirmado','enviado')").get();
  const productsCount = db.prepare('SELECT COUNT(*) AS count FROM products WHERE active = 1').get();
  const lowStockRows = db.prepare('SELECT ps.stock, ps.last_inbound, ps.product_id, p.active FROM product_sizes ps JOIN products p ON p.id = ps.product_id').all();
  const lowStock = lowStockRows.filter(r => r.active && r.stock <= 2).length;
  const aging = lowStockRows.filter(r => r.active && r.stock > 0 && ageDays(r.last_inbound) > 30).length;
  const totalUnitsSold = db.prepare("SELECT COALESCE(SUM(quantity),0) AS total FROM sale_items si JOIN sales s ON s.id = si.sale_id WHERE s.status != 'cancelado'").get();

  const inventoryValue = db.prepare(`
    SELECT COALESCE(SUM(ps.stock * p.price), 0) AS total
    FROM product_sizes ps JOIN products p ON p.id = ps.product_id
  `).get();

  res.json({
    sales_today: today.total,
    orders_today: today.count,
    pending_orders: pending.count,
    active_products: productsCount.count,
    low_stock: lowStock,
    aging_alerts: aging,
    units_sold: totalUnitsSold.total,
    inventory_value: inventoryValue.total
  });
});

app.get('/api/inventory', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
  const data = rows.map(r => {
    const sizes = sizesWithAge(r.id);
    const totalStock = sizes.reduce((a, s) => a + s.stock, 0);
    const sold = db.prepare(`
      SELECT COALESCE(SUM(si.quantity),0) AS q FROM sale_items si
      JOIN sales s ON s.id = si.sale_id
      WHERE si.product_id = ? AND s.status != 'cancelado'
    `).get(r.id).q;
    return { ...productRow(r), sizes, total_stock: totalStock, units_sold: sold };
  });
  res.json(data);
});

app.get('/api/reports/sales', (req, res) => {
  const group = req.query.group || 'day'; // day | category | product
  const from = req.query.from;
  const to = req.query.to;
  const filter = from && to ? "AND s.created_at >= ? || ' 00:00:00' AND s.created_at <= ? || ' 23:59:59'" : '';
  const params = [];
  if (from && to) { params.push(from, to); }

  let rows;
  if (group === 'month') {
    rows = db.prepare(`
      SELECT substr(s.created_at, 1, 7) AS label,
             COUNT(*) AS orders,
             COALESCE(SUM(s.total), 0) AS revenue,
             COALESCE(SUM((SELECT COALESCE(SUM(si2.quantity), 0) FROM sale_items si2 WHERE si2.sale_id = s.id)), 0) AS units
      FROM sales s WHERE s.status != 'cancelado' ${filter}
      GROUP BY label ORDER BY label
    `).all(...params);
    return res.json(rows);
  } else if (group === 'day') {
    rows = db.prepare(`
      SELECT date(s.created_at) AS label, COUNT(*) AS orders, COALESCE(SUM(s.total),0) AS revenue
      FROM sales s WHERE s.status != 'cancelado' ${filter}
      GROUP BY date(s.created_at) ORDER BY label
    `).all(...params);
  } else if (group === 'category') {
    rows = db.prepare(`
      SELECT COALESCE(p.category, si.product_name) AS label,
             COALESCE(SUM(si.quantity),0) AS units,
             COALESCE(SUM(si.quantity * si.unit_price),0) AS revenue
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      LEFT JOIN products p ON p.id = si.product_id
      WHERE s.status != 'cancelado' ${filter}
      GROUP BY label ORDER BY units DESC
    `).all(...params);
    return res.json(rows);
  } else {
    rows = db.prepare(`
      SELECT si.product_name AS label,
             SUM(si.quantity) AS units,
             SUM(si.quantity * si.unit_price) AS revenue
      FROM sale_items si JOIN sales s ON s.id = si.sale_id
      WHERE s.status != 'cancelado' ${filter}
      GROUP BY si.product_name ORDER BY units DESC
    `).all(...params);
    return res.json(rows);
  }
  res.json(rows);
});

// ---------- FALLBACK SPA ----------

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/panel', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  console.log(`Tienda VOCCEL corriendo en http://localhost:${PORT}`);
  console.log(`  - Tienda:      http://localhost:${PORT}/#/tienda`);
  console.log(`  - Panel admin: http://localhost:${PORT}/#/panel`);
});