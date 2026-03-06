import express from 'express';
import { createServer as createViteServer } from 'vite';
import pg from 'pg';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "dailytasklist",
  password: "Veera2211@",
  port: 5437,
  connectionTimeoutMillis: 5000,
});

async function initDb() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS tasks (
          id UUID PRIMARY KEY,
          user_id TEXT NOT NULL,
          date DATE NOT NULL,
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          topic TEXT NOT NULL,
          duration INTEGER NOT NULL,
          completed BOOLEAN DEFAULT FALSE,
          completion_percentage INTEGER DEFAULT 0,
          start_time TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
        );
      `);
      console.log('Database initialized successfully');
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('DATABASE CONNECTION ERROR:', err instanceof Error ? err.message : err);
    console.error('Please ensure DATABASE_URL is correct and the database is accessible.');
    if (process.env.DATABASE_URL?.includes('localhost') || process.env.DATABASE_URL?.includes('127.0.0.1')) {
      console.error('NOTE: "localhost" or "127.0.0.1" in DATABASE_URL refers to the application container, not your local machine.');
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  await initDb();

  // Database Status Check
  app.get('/api/db-status', async (req, res) => {
    try {
      const client = await pool.connect();
      client.release();
      res.json({ connected: true });
    } catch (err) {
      res.json({ connected: false, error: err instanceof Error ? err.message : 'Connection failed' });
    }
  });

  // API Routes
  app.get('/api/tasks/:userId', async (req, res) => {
    try {
      const { userId } = req.params;
      const result = await pool.query(
        'SELECT * FROM tasks WHERE user_id = $1 ORDER BY date DESC, start_time ASC',
        [userId]
      );
      
      // Map database fields back to camelCase
      const tasks = result.rows.map(row => ({
        id: row.id,
        userId: row.user_id,
        date: row.date.toISOString().split('T')[0],
        title: row.title,
        category: row.category,
        topic: row.topic,
        duration: row.duration,
        completed: row.completed,
        completionPercentage: row.completion_percentage,
        startTime: row.start_time
      }));
      
      res.json(tasks);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post('/api/tasks', async (req, res) => {
    try {
      const { id, userId, date, title, category, topic, duration, completed, completionPercentage, startTime } = req.body;
      await pool.query(
        `INSERT INTO tasks (id, user_id, date, title, category, topic, duration, completed, completion_percentage, start_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [id, userId, date, title, category, topic, duration, completed, completionPercentage, startTime]
      );
      res.status(201).json({ message: 'Task created' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put('/api/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { title, category, topic, duration, completed, completionPercentage, startTime } = req.body;
      await pool.query(
        `UPDATE tasks 
         SET title = $1, category = $2, topic = $3, duration = $4, completed = $5, completion_percentage = $6, start_time = $7
         WHERE id = $8`,
        [title, category, topic, duration, completed, completionPercentage, startTime, id]
      );
      res.json({ message: 'Task updated' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete('/api/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await pool.query('DELETE FROM tasks WHERE id = $1', [id]);
      res.json({ message: 'Task deleted' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
