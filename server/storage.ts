import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { SavedDesign, Order } from '../shared/types';

export interface StoredOrder { order: Order; requestHash: string; }
export interface Storage {
  kind: 'local' | 'supabase';
  checkHealth(): Promise<void>;
  listDesigns(owner: string): Promise<SavedDesign[]>;
  getDesign(owner: string, id: string): Promise<SavedDesign | undefined>;
  putDesign(owner: string, design: SavedDesign): Promise<void>;
  deleteDesign(owner: string, id: string): Promise<boolean>;
  listOrders(owner: string): Promise<Order[]>;
  getOrderByKey(owner: string, key: string): Promise<StoredOrder | undefined>;
  createOrder(owner: string, key: string, hash: string, order: Order): Promise<StoredOrder>;
  close?(): void;
}

export class SqliteStorage implements Storage {
  kind = 'local' as const;
  private db: DatabaseSync;
  constructor(path = resolve('.data/charm-studio.sqlite')) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS designs (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE INDEX IF NOT EXISTS designs_owner ON designs(owner_id, updated_at DESC);
      CREATE TABLE IF NOT EXISTS orders (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL, idempotency_key TEXT NOT NULL, request_hash TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL, UNIQUE(owner_id, idempotency_key));
      CREATE INDEX IF NOT EXISTS orders_owner ON orders(owner_id, created_at DESC);
    `);
  }
  async checkHealth(): Promise<void> {
    this.db.prepare('SELECT id FROM designs LIMIT 0').all();
    this.db.prepare('SELECT id FROM orders LIMIT 0').all();
  }
  async listDesigns(owner: string): Promise<SavedDesign[]> {
    return this.db.prepare('SELECT payload FROM designs WHERE owner_id = ? ORDER BY updated_at DESC').all(owner).map(row => JSON.parse(row.payload as string));
  }
  async getDesign(owner: string, id: string): Promise<SavedDesign | undefined> {
    const row = this.db.prepare('SELECT payload FROM designs WHERE owner_id = ? AND id = ?').get(owner, id);
    return row ? JSON.parse(row.payload as string) : undefined;
  }
  async putDesign(owner: string, design: SavedDesign): Promise<void> {
    this.db.prepare('INSERT INTO designs(id, owner_id, payload, updated_at) VALUES(?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at WHERE designs.owner_id=excluded.owner_id').run(design.id, owner, JSON.stringify(design), design.updatedAt);
  }
  async deleteDesign(owner: string, id: string): Promise<boolean> {
    return this.db.prepare('DELETE FROM designs WHERE owner_id = ? AND id = ?').run(owner, id).changes > 0;
  }
  async listOrders(owner: string): Promise<Order[]> {
    return this.db.prepare('SELECT payload FROM orders WHERE owner_id = ? ORDER BY created_at DESC').all(owner).map(row => JSON.parse(row.payload as string));
  }
  async getOrderByKey(owner: string, key: string): Promise<StoredOrder | undefined> {
    const row = this.db.prepare('SELECT payload, request_hash FROM orders WHERE owner_id = ? AND idempotency_key = ?').get(owner, key);
    return row ? { order: JSON.parse(row.payload as string), requestHash: row.request_hash as string } : undefined;
  }
  async createOrder(owner: string, key: string, hash: string, order: Order): Promise<StoredOrder> {
    this.db.prepare('INSERT INTO orders(id, owner_id, idempotency_key, request_hash, payload, created_at) VALUES(?, ?, ?, ?, ?, ?) ON CONFLICT(owner_id, idempotency_key) DO NOTHING').run(order.id, owner, key, hash, JSON.stringify(order), order.createdAt);
    return (await this.getOrderByKey(owner, key))!;
  }
  close(): void { this.db.close(); }
}

type DesignRow = { id: string; name: string; config: SavedDesign['config']; created_at: string; updated_at: string };
type OrderRow = { id: string; design_name: string; config: Order['config']; quote: Order['quote']; status: 'test_confirmed'; created_at: string; request_hash: string };
const toDesign = (row: DesignRow): SavedDesign => ({ id: row.id, name: row.name, config: row.config, createdAt: row.created_at, updatedAt: row.updated_at });
const toOrder = (row: OrderRow): Order => ({ id: row.id, designName: row.design_name, config: row.config, quote: row.quote, status: row.status, createdAt: row.created_at });
const designColumns = 'id,name,config,created_at,updated_at';
const orderColumns = 'id,design_name,config,quote,status,created_at,request_hash';

export class SupabaseStorage implements Storage {
  kind = 'supabase' as const;
  private client: SupabaseClient;
  constructor(url: string, key: string) {
    this.client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }
  async checkHealth(): Promise<void> {
    const checks = await Promise.all(['charm_designs', 'charm_orders'].map(table => this.client.from(table).select('id').limit(0)));
    for (const check of checks) if (check.error) throw check.error;
  }
  async listDesigns(owner: string): Promise<SavedDesign[]> {
    const { data, error } = await this.client.from('charm_designs').select(designColumns).eq('owner_id', owner).order('updated_at', { ascending: false });
    if (error) throw error;
    return (data as DesignRow[]).map(toDesign);
  }
  async getDesign(owner: string, id: string): Promise<SavedDesign | undefined> {
    const { data, error } = await this.client.from('charm_designs').select(designColumns).eq('owner_id', owner).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? toDesign(data as DesignRow) : undefined;
  }
  async putDesign(owner: string, design: SavedDesign): Promise<void> {
    const previous = await this.getDesign(owner, design.id);
    const values = { name: design.name, config: design.config, updated_at: design.updatedAt };
    // Do not upsert by id: the owner predicate must apply to every update.
    const result = previous
      ? await this.client.from('charm_designs').update(values).eq('id', design.id).eq('owner_id', owner)
      : await this.client.from('charm_designs').insert({ ...values, id: design.id, owner_id: owner, created_at: design.createdAt });
    if (result.error) throw result.error;
  }
  async deleteDesign(owner: string, id: string): Promise<boolean> {
    const { data, error } = await this.client.from('charm_designs').delete().eq('owner_id', owner).eq('id', id).select('id');
    if (error) throw error;
    return !!data?.length;
  }
  async listOrders(owner: string): Promise<Order[]> {
    const { data, error } = await this.client.from('charm_orders').select(orderColumns).eq('owner_id', owner).order('created_at', { ascending: false });
    if (error) throw error;
    return (data as OrderRow[]).map(toOrder);
  }
  async getOrderByKey(owner: string, key: string): Promise<StoredOrder | undefined> {
    const { data, error } = await this.client.from('charm_orders').select(orderColumns).eq('owner_id', owner).eq('idempotency_key', key).maybeSingle();
    if (error) throw error;
    return data ? { order: toOrder(data as OrderRow), requestHash: data.request_hash } : undefined;
  }
  async createOrder(owner: string, key: string, hash: string, order: Order): Promise<StoredOrder> {
    const { error } = await this.client.from('charm_orders').insert({ id: order.id, owner_id: owner, idempotency_key: key, request_hash: hash, design_name: order.designName, config: order.config, quote: order.quote, status: order.status, created_at: order.createdAt });
    if (error && error.code !== '23505') throw error;
    const stored = await this.getOrderByKey(owner, key);
    if (!stored) throw new Error('Order could not be persisted');
    return stored;
  }
}

export function storageFromEnvironment(): Storage {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (url && key) return new SupabaseStorage(url, key);
  if (url || key) throw new Error('Set both SUPABASE_URL and SUPABASE_SECRET_KEY, or leave both empty for local storage.');
  return new SqliteStorage(process.env.SQLITE_PATH);
}
