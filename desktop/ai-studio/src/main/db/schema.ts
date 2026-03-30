import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = path.join(app.getPath('userData'), 'ai-studio.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initSchema(db);
  }
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS endpoints (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      api_key TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS system_prompts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS sampling_presets (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      temperature REAL NOT NULL DEFAULT 1.0,
      top_p REAL NOT NULL DEFAULT 0.9,
      top_k INTEGER NOT NULL DEFAULT 20,
      max_tokens INTEGER NOT NULL DEFAULT 65536,
      repeat_penalty REAL NOT NULL DEFAULT 1.1,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch())
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      endpoint_id TEXT NOT NULL,
      model_id TEXT NOT NULL,
      system_prompt_id TEXT,
      sampling_preset_id TEXT,
      folder_id TEXT,
      last_stats TEXT,
      last_tool_activity TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      updated_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (endpoint_id) REFERENCES endpoints(id),
      FOREIGN KEY (system_prompt_id) REFERENCES system_prompts(id),
      FOREIGN KEY (sampling_preset_id) REFERENCES sampling_presets(id),
      FOREIGN KEY (folder_id) REFERENCES folders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool', 'tool_call')),
      content TEXT NOT NULL,
      attachments TEXT,
      tool_call_id TEXT,
      tool_call_name TEXT,
      created_at INTEGER NOT NULL DEFAULT (unixepoch()),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_conversation
      ON messages(conversation_id, created_at);
  `);

  // Migration: add folder_id to existing conversations table
  const cols = db.pragma('table_info(conversations)') as { name: string }[];
  if (!cols.some(c => c.name === 'folder_id')) {
    db.exec('ALTER TABLE conversations ADD COLUMN folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL');
  }
  if (!cols.some(c => c.name === 'last_stats')) {
    db.exec('ALTER TABLE conversations ADD COLUMN last_stats TEXT');
  }
  if (!cols.some(c => c.name === 'last_tool_activity')) {
    db.exec('ALTER TABLE conversations ADD COLUMN last_tool_activity TEXT');
  }

  // Migration: add tool_call_name + expand role CHECK to include 'tool_call'
  const msgCols = db.pragma('table_info(messages)') as { name: string }[];
  if (!msgCols.some(c => c.name === 'tool_call_name')) {
    // Need to recreate table to update CHECK constraint
    // Temporarily disable foreign keys for the migration
    db.pragma('foreign_keys = OFF');
    db.exec(`
      CREATE TABLE messages_new (
        id TEXT PRIMARY KEY,
        conversation_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant', 'tool', 'tool_call')),
        content TEXT NOT NULL,
        attachments TEXT,
        tool_call_id TEXT,
        tool_call_name TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
      );
      INSERT INTO messages_new (id, conversation_id, role, content, attachments, tool_call_id, created_at)
        SELECT id, conversation_id, role, content, attachments, tool_call_id, created_at FROM messages;
      DROP TABLE messages;
      ALTER TABLE messages_new RENAME TO messages;
      CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at);
    `);
    db.pragma('foreign_keys = ON');
  }

  // Seed default endpoint on first run
  const endpointCount = (db.prepare('SELECT COUNT(*) as c FROM endpoints').get() as { c: number }).c;
  if (endpointCount === 0) {
    const { randomUUID } = require('crypto');
    db.prepare('INSERT INTO endpoints (id, name, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(randomUUID(), 'Local Server', 'http://127.0.0.1:8000/v1', Date.now(), Date.now());
  }
}

export function closeDb() {
  if (db) {
    db.close();
  }
}
