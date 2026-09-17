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
      price REAL NOT NULL DEFAULT 0,
      image TEXT DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS product_sizes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      size TEXT NOT NULL,
      stock INTEGER NOT NULL DEFAULT 0,
      UNIQUE(product_id, size)
    );

    CREATE TABLE IF NOT EXISTS sales (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_name TEXT NOT NULL,
      customer_phone TEXT DEFAULT '',
      customer_email TEXT DEFAULT '',
      address TEXT DEFAULT '',
      delivery_method TEXT NOT NULL DEFAULT 'envio',   -- envio | retiro
      shipping_fee REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendiente',          -- pendiente | confirmado | enviado | entregado | cancelado
      subtotal REAL NOT NULL DEFAULT 0,
      total REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
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
      status TEXT NOT NULL DEFAULT 'pendiente',          -- pendiente | en_reparto | entregado | devuelto
      estimated_date TEXT DEFAULT '',
      delivered_at TEXT DEFAULT ''
    );
  `);
}

function seedIfEmpty() {
  const count = db.prepare('SELECT COUNT(*) AS c FROM products').get().c;
  if (count > 0) return;

  const products = [
    { name: 'Camiseta Urban Básica', category: 'Camisetas', price: 19.99, image: 'https://placehold.co/600x800/1f2937/ffffff?text=Camiseta', description: 'Camiseta de algodón 100% peinado, corte slim. Básica de todos los días.' },
    { name: 'Hoodie VOCCEL Classic', category: 'Sudaderas', price: 49.99, image: 'https://placehold.co/600x800/0f172a/ffffff?text=Hoodie', description: 'Sudadera con capucha de felpa francesa, interior cepillado y capucha de doble capa.' },
    { name: 'Jean Slim Fit Destroyed', category: 'Pantalones', price: 59.99, image: 'https://placehold.co/600x800/1e3a8a/ffffff?text=Jean', description: 'Jean slim fit con desgastes, mezclilla elástica cómoda para todo el día.' },
    { name: 'Chamarra Bomber Negra', category: 'Chaquetas', price: 79.99, image: 'https://placehold.co/600x800/111827/ffffff?text=Bomber', description: 'Chamarra bomber con forro acolchado, bolsillos con cremallera y puños de punto.' },
    { name: 'Polo Deportiva Corte Clásico', category: 'Camisetas', price: 29.99, image: 'https://placehold.co/600x800/14532d/ffffff?text=Polo', description: 'Polo de piqué transpirable, cuello estructurado y botonadura de 3 botones.' },
    { name: 'Pantalón Cargo Táctico', category: 'Pantalones', price: 54.99, image: 'https://placehold.co/600x800/3f3f46/ffffff?text=Cargo', description: 'Cargo de 6 bolsillos, tela de ripstop resistente y cintura ajustable.' },
    { name: 'Chaleco Acolchado Ligero', category: 'Chaquetas', price: 69.99, image: 'https://placehold.co/600x800/334155/ffffff?text=Chaleco', description: 'Chaleco sin mangas ultraligero, ideal para capas en días frescos.' },
    { name: 'Sudadera Oversize Canguro', category: 'Sudaderas', price: 45.99, image: 'https://placehold.co/600x800/4c1d95/ffffff?text=Oversize', description: 'Sudadera oversize con bolsillo canguro y algodón hilado grueso. Fit holgado.' },
    { name: 'Camisa Oxford Formal', category: 'Camisetas', price: 39.99, image: 'https://placehold.co/600x800/7f1d1d/ffffff?text=Oxford', description: 'Camisa oxford de botonadura completa, tela de algodón oxford clásica.' },
    { name: 'Leggings Deportivos Alta Compresión', category: 'Deportivo', price: 34.99, image: 'https://placehold.co/600x800/155e75/ffffff?text=Leggings', description: 'Leggings de alta compresión con cintura alta y tela de secado rápido.' }
  ];

  const sizes = ['S', 'M', 'L', 'XL'];

  const insP = db.prepare('INSERT INTO products (name, description, category, price, image) VALUES (?, ?, ?, ?, ?)');
  const insS = db.prepare('INSERT INTO product_sizes (product_id, size, stock) VALUES (?, ?, ?)');

  products.forEach((p, idx) => {
    const res = insP.run(p.name, p.description, p.category, p.price, p.image);
    const pid = res.lastInsertRowid;
    sizes.forEach((s, si) => {
      let stock = 8 + ((idx * 3 + si * 5) % 25);
      if ((idx + si) % 7 === 0) stock = 0;
      if (idx === 3 && si === 0) stock = 0;
      insS.run(pid, s, stock);
    });
  });
}

init();
seedIfEmpty();

module.exports = db;