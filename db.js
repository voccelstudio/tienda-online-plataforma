const { DatabaseSync } = require('node:sqlite');
const path = require('node:path');
const fs = require('node:fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'tienda.db'));
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

function init() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT 'ropa',
      list_price REAL NOT NULL DEFAULT 0,
      price REAL NOT NULL DEFAULT 0,
      discount INTEGER NOT NULL DEFAULT 0,
      image TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      last_inbound TEXT,
      UNIQUE(product_id, size)
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL,
      size TEXT DEFAULT '',
      type TEXT NOT NULL,               -- entrada | salida | ajuste | devolucion
      qty INTEGER NOT NULL,
      note TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      customer_email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      delivery_method TEXT NOT NULL DEFAULT 'envio',
      shipping_fee REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente',
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      pickup_date TEXT DEFAULT '',
      delivery_date TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sale_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
      product_id INTEGER NOT NULL,
      product_name TEXT NOT NULL,
      size TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price REAL NOT NULL
    );

    CREATE TABLE IF NOT EXISTS deliveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sale_id INTEGER NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
      courier TEXT DEFAULT '',
      tracking_number TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pendiente',
      estimated_date TEXT DEFAULT '',
      delivered_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS settings (
      k TEXT PRIMARY KEY,
      v TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      type TEXT NOT NULL DEFAULT 'percent',
      value REAL NOT NULL DEFAULT 0,
      min_purchase REAL NOT NULL DEFAULT 0,
      max_uses INTEGER NOT NULL DEFAULT 0,
      uses INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // migracion de esquemas previos
  const cols = db.prepare('PRAGMA table_info(products)').all().map(c => c.name);
  if (!cols.includes('list_price')) db.exec('ALTER TABLE products ADD COLUMN list_price REAL NOT NULL DEFAULT 0');
  if (!cols.includes('discount')) db.exec('ALTER TABLE products ADD COLUMN discount INTEGER NOT NULL DEFAULT 0');
  const scols = db.prepare('PRAGMA table_info(product_sizes)').all().map(c => c.name);
  if (!scols.includes('last_inbound')) db.exec('ALTER TABLE product_sizes ADD COLUMN last_inbound TEXT');
  db.exec("UPDATE product_sizes SET last_inbound = (SELECT created_at FROM products WHERE id = product_id) WHERE last_inbound IS NULL");
  const sacols = db.prepare('PRAGMA table_info(sales)').all().map(c => c.name);
  if (!sacols.includes('payment_method')) db.exec("ALTER TABLE sales ADD COLUMN payment_method TEXT DEFAULT ''");
  if (!sacols.includes('payment_ref')) db.exec("ALTER TABLE sales ADD COLUMN payment_ref TEXT DEFAULT ''");
  if (!sacols.includes('payment_status')) db.exec("ALTER TABLE sales ADD COLUMN payment_status TEXT DEFAULT 'pendiente'");
  if (!sacols.includes('pickup_point')) db.exec("ALTER TABLE sales ADD COLUMN pickup_point TEXT DEFAULT ''");
  if (!sacols.includes('coupon_code')) db.exec("ALTER TABLE sales ADD COLUMN coupon_code TEXT DEFAULT ''");
  if (!sacols.includes('coupon_discount')) db.exec("ALTER TABLE sales ADD COLUMN coupon_discount REAL NOT NULL DEFAULT 0");
  if (!sacols.includes('tax_amount')) db.exec("ALTER TABLE sales ADD COLUMN tax_amount REAL NOT NULL DEFAULT 0");
  const images = {
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
const updImg = db.prepare('UPDATE products SET image = ? WHERE name = ? AND image LIKE ?');
for (const [n, u] of Object.entries(images)) updImg.run(u, n, '%placehold%');
db.exec("UPDATE products SET list_price = price WHERE list_price = 0");
  if (!sacols.includes('pickup_date')) db.exec("ALTER TABLE sales ADD COLUMN pickup_date TEXT DEFAULT ''");
  if (!sacols.includes('delivery_date')) db.exec("ALTER TABLE sales ADD COLUMN delivery_date TEXT DEFAULT ''");
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;

  const products = [
    { name: 'Camiseta Urban Básica', category: 'Camisetas', price: 199000, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=800&auto=format&fit=crop', description: 'Camiseta de algodón 100% peinado, corte slim. Básica de todos los días.' },
    { name: 'Hoodie VOCCEL Classic', category: 'Sudaderas', price: 449000, image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=800&auto=format&fit=crop', description: 'Sudadera con capucha de felpa francesa, interior cepillado y capucha de doble capa.' },
    { name: 'Jean Slim Fit Destroyed', category: 'Pantalones', price: 549000, image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=800&auto=format&fit=crop', description: 'Jean slim fit con desgastes, mezclilla elástica cómoda para todo el día.' },
    { name: 'Chamarra Bomber Negra', category: 'Chaquetas', price: 749000, image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=800&auto=format&fit=crop', description: 'Chamarra bomber con forro acolchado, bolsillos con cremallera y puños de punto.' },
    { name: 'Polo Deportiva Corte Clásico', category: 'Camisetas', price: 279000, image: 'https://images.unsplash.com/photo-1598033129183-c4f50c736f10?q=80&w=800&auto=format&fit=crop', description: 'Polo de piqué transpirable, cuello estructurado y botonadura de 3 botones.' },
    { name: 'Pantalón Cargo Táctico', category: 'Pantalones', price: 499000, image: 'https://images.unsplash.com/photo-1473966968600-fa801b869a1a?q=80&w=800&auto=format&fit=crop', description: 'Cargo de 6 bolsillos, tela de ripstop resistente y cintura ajustable.' },
    { name: 'Chaleco Acolchado Ligero', category: 'Chaquetas', price: 649000, image: 'https://images.unsplash.com/photo-1548624313-0396c75e4b1a?q=80&w=800&auto=format&fit=crop', description: 'Chaleco sin mangas ultraligero, ideal para capas en días frescos.' },
    { name: 'Sudadera Oversize Canguro', category: 'Sudaderas', price: 419000, image: 'https://images.unsplash.com/photo-1509942774463-acf339cf87d5?q=80&w=800&auto=format&fit=crop', description: 'Sudadera oversize con bolsillo canguro y algodón hilado grueso. Fit holgado.' },
    { name: 'Camisa Oxford Formal', category: 'Camisetas', price: 359000, image: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?q=80&w=800&auto=format&fit=crop', description: 'Camisa oxford de botonadura completa, tela de algodón oxford clásica.' },
    { name: 'Leggings Deportivos Alta Compresión', category: 'Deportivo', price: 319000, image: 'https://images.unsplash.com/photo-1506629082955-511b1aa562c8?q=80&w=800&auto=format&fit=crop', description: 'Leggings de alta compresión con cintura alta y tela de secado rápido.' }
  ];

  const sizes = ['S', 'M', 'L', 'XL'];
  const created = new Date().toISOString();

  const insP = db.prepare('INSERT INTO products (name, description, category, list_price, price, discount, image) VALUES (?, ?, ?, ?, ?, 0, ?)');
  const insS = db.prepare('INSERT INTO product_sizes (product_id, size, stock, last_inbound) VALUES (?, ?, ?, ?)');
  const insM = db.prepare('INSERT INTO stock_movements (product_id, size, type, qty, note, created_at) VALUES (?, ?, ?, ?, ?, ?)');

  products.forEach((p, idx) => {
    const res = insP.run(p.name, p.description, p.category, p.price, p.price, p.image);
    const pid = res.lastInsertRowid;
    sizes.forEach((s, si) => {
      let stock = 8 + ((idx * 3 + si * 5) % 25);
      if ((idx + si) % 7 === 0) stock = 0;
      if (idx === 3 && si === 0) stock = 0;
      const lb = idx % 2 === 0 ? new Date(Date.now() - (5 + idx) * 86400000).toISOString() : new Date(Date.now() - (40 + si * 3) * 86400000).toISOString();
      insS.run(pid, s, stock, lb);
      if (stock > 0) insM.run(pid, s, 'entrada', stock, 'Carga inicial', lb);
    });
  });
}

init();
seedIfEmpty();

if (!db.prepare('SELECT 1 FROM settings WHERE k = ?').get('app')) {
  db.prepare('INSERT INTO settings (k, v) VALUES (?, ?)').run('app', JSON.stringify({
    store_name: 'VOCCEL',
    whatsapp: '',
    delivery_fee: 20000,
    free_delivery_over: 0,
    iva: 0,
    iva_calc: 'incluido',
    payment_methods: { efectivo: true, transferencia: true, qr: true },
    transfer_info: '',
    qr_info: '',
    pickup_points: [{ name: 'Tienda VOCCEL', address: '', hours: '' }],
    pickup_slots: ['09:00 - 12:00', '14:00 - 17:00', '17:00 - 19:00'],
    pending_expire_days: 0,
    hero_slides: [
      { image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?q=80&w=1600&auto=format&fit=crop', tag: 'Nueva temporada', title: 'Camisetas urbanas', subtitle: 'Corte actual, algodón premium y stock en tiempo real.', link: '' },
      { image: 'https://images.unsplash.com/photo-1556821840-3a63f95609a7?q=80&w=1600&auto=format&fit=crop', tag: 'Para el frío', title: 'Hoodies VOCCEL Classic', subtitle: 'Felpa francesa cepillada, de S a XL.', link: '' },
      { image: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?q=80&w=1600&auto=format&fit=crop', tag: 'Look de ciudad', title: 'Chaquetas bomber', subtitle: 'Acolchadas, con cierres y actitud.', link: '' },
      { image: 'https://images.unsplash.com/photo-1542272604-787c3835535d?q=80&w=1600&auto=format&fit=crop', tag: 'Esenciales', title: 'Jeans slim fit', subtitle: 'Mezclilla elástica que se adapta a tu día.', link: '' }
    ]
  }));
}
if (!db.prepare('SELECT 1 FROM coupons LIMIT 1').get()) {
  db.prepare("INSERT INTO coupons (code, type, value) VALUES (?, 'percent', ?)").run('VOCCEL10', 10);
}

module.exports = db;