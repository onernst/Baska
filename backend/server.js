import express from 'express';
import cors from 'cors';
import Database from 'better-sqlite3';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());

// Database setup
const dbPath = join(__dirname, 'baska.db');
const db = new Database(dbPath);

// Initialize database schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    qty INTEGER NOT NULL DEFAULT 1,
    store TEXT,
    added_by TEXT,
    done INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    option TEXT,
    message TEXT,
    unit TEXT DEFAULT 'unit',
    user_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS stores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  );

  CREATE INDEX IF NOT EXISTS idx_items_store ON items(store);
  CREATE INDEX IF NOT EXISTS idx_items_done ON items(done);
  CREATE INDEX IF NOT EXISTS idx_items_user ON items(user_id);
`);

// Authentication middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

// API Routes

// Auth Routes
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const stmt = db.prepare('INSERT INTO users (name, email, password) VALUES (?, ?, ?)');
    const result = stmt.run(name, email, hashedPassword);

    // Generate token
    const token = jwt.sign(
      { id: result.lastInsertRowid, email, name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const user = db.prepare('SELECT id, name, email FROM users WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json({ user, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const { password: _, ...userWithoutPassword } = user;
    res.json({ user: userWithoutPassword, token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Protected Routes
// Get all items
app.get('/api/items', authenticateToken, (req, res) => {
  try {
    const items = db.prepare('SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get single item
app.get('/api/items/:id', authenticateToken, (req, res) => {
  try {
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create item
app.post('/api/items', authenticateToken, (req, res) => {
  try {
    const { name, qty = 1, store, addedBy, note, option, message, unit = 'unit' } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const stmt = db.prepare(`
      INSERT INTO items (name, qty, store, added_by, note, option, message, unit, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(name, qty, store, addedBy, note, option, message, unit, req.user.id);
    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update item
app.put('/api/items/:id', authenticateToken, (req, res) => {
  try {
    const { name, qty, store, addedBy, done, note, option, message, unit } = req.body;
    
    const stmt = db.prepare(`
      UPDATE items 
      SET name = ?, qty = ?, store = ?, added_by = ?, done = ?, note = ?, option = ?, message = ?, unit = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND user_id = ?
    `);

    const result = stmt.run(name, qty, store, addedBy, done ? 1 : 0, note, option, message, unit, req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete item
app.delete('/api/items/:id', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM items WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ message: 'Item deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Toggle item done status
app.patch('/api/items/:id/toggle', authenticateToken, (req, res) => {
  try {
    const stmt = db.prepare('UPDATE items SET done = NOT done, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?');
    const result = stmt.run(req.params.id, req.user.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }

    const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
    res.json(item);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all stores
app.get('/api/stores', (req, res) => {
  try {
    const stores = db.prepare('SELECT * FROM stores ORDER BY name').all();
    res.json(stores);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create store
app.post('/api/stores', (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const stmt = db.prepare('INSERT INTO stores (name) VALUES (?)');
    const result = stmt.run(name);
    const store = db.prepare('SELECT * FROM stores WHERE id = ?').get(result.lastInsertRowid);

    res.status(201).json(store);
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT') {
      res.status(409).json({ error: 'Store already exists' });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Delete store
app.delete('/api/stores/:id', (req, res) => {
  try {
    const stmt = db.prepare('DELETE FROM stores WHERE id = ?');
    const result = stmt.run(req.params.id);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Store not found' });
    }

    res.json({ message: 'Store deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`Baska backend running on http://localhost:${PORT}`);
  console.log(`Database: ${dbPath}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down gracefully...');
  db.close();
  process.exit(0);
});
