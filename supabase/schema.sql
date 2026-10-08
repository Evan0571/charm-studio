-- Server-owned guest records. The HTTP API authenticates an unguessable cookie,
-- hashes it to owner_id, and scopes every data operation to that owner.
-- No browser database keys can read/write these tables.
CREATE TABLE IF NOT EXISTS public.charm_designs (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (owner_id ~ '^[a-f0-9]{64}$'),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 50),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS charm_designs_owner_updated_idx ON public.charm_designs (owner_id, updated_at DESC);
ALTER TABLE public.charm_designs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charm_designs FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charm_designs TO service_role;

CREATE TABLE IF NOT EXISTS public.charm_orders (
  id uuid PRIMARY KEY,
  owner_id text NOT NULL CHECK (owner_id ~ '^[a-f0-9]{64}$'),
  idempotency_key text NOT NULL CHECK (char_length(idempotency_key) BETWEEN 8 AND 128),
  request_hash text NOT NULL CHECK (request_hash ~ '^[a-f0-9]{64}$'),
  design_name text NOT NULL CHECK (char_length(design_name) BETWEEN 1 AND 50),
  config jsonb NOT NULL CHECK (jsonb_typeof(config) = 'object'),
  quote jsonb NOT NULL CHECK (jsonb_typeof(quote) = 'object'),
  status text NOT NULL DEFAULT 'test_confirmed' CHECK (status = 'test_confirmed'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS charm_orders_owner_created_idx ON public.charm_orders (owner_id, created_at DESC);
ALTER TABLE public.charm_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charm_orders FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.charm_orders TO service_role;
