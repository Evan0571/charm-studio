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

-- Supabase can create this event-trigger helper when automatic RLS is selected.
-- Keep the trigger active but prevent clients from invoking its definer function.
DO $$ BEGIN
  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    REVOKE EXECUTE ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated;
  END IF;
END $$;

-- Shared OAuth state for stateless Vercel functions. Server credentials only.
CREATE TABLE IF NOT EXISTS public.charm_oauth_records (
  namespace text NOT NULL CHECK (char_length(namespace) BETWEEN 1 AND 300),
  kind text NOT NULL CHECK (kind IN ('client', 'consent', 'code', 'grant', 'refresh')),
  id text NOT NULL CHECK (char_length(id) BETWEEN 1 AND 128),
  value jsonb NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  expires_at timestamptz,
  PRIMARY KEY (namespace, kind, id)
);
CREATE INDEX IF NOT EXISTS charm_oauth_expiry_idx ON public.charm_oauth_records (namespace, expires_at) WHERE expires_at IS NOT NULL;
ALTER TABLE public.charm_oauth_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charm_oauth_records FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.charm_oauth_records TO service_role;

-- One transaction performs expiry cleanup, capacity check and upsert.
-- The namespace lock serializes competing registrations across instances.
CREATE OR REPLACE FUNCTION public.loop_oauth_put(
  p_namespace text, p_kind text, p_id text, p_value jsonb, p_expires_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_namespace, 0));
  DELETE FROM public.charm_oauth_records
    WHERE namespace = p_namespace AND expires_at <= now();
  IF NOT EXISTS (
    SELECT 1 FROM public.charm_oauth_records
    WHERE namespace = p_namespace AND kind = p_kind AND id = p_id
  ) AND (SELECT count(*) FROM public.charm_oauth_records WHERE namespace = p_namespace) >= 5000 THEN
    RAISE EXCEPTION 'OAuth store capacity reached';
  END IF;
  INSERT INTO public.charm_oauth_records (namespace, kind, id, value, expires_at)
    VALUES (p_namespace, p_kind, p_id, p_value, p_expires_at)
    ON CONFLICT (namespace, kind, id) DO UPDATE
      SET value = excluded.value, expires_at = excluded.expires_at;
END;
$$;
REVOKE ALL ON FUNCTION public.loop_oauth_put(text, text, text, jsonb, timestamptz) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.loop_oauth_put(text, text, text, jsonb, timestamptz) TO service_role;

-- DELETE ... RETURNING has exactly one winner, even with concurrent requests.
CREATE OR REPLACE FUNCTION public.loop_oauth_consume(p_namespace text, p_kind text, p_id text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE consumed jsonb;
BEGIN
  DELETE FROM public.charm_oauth_records
    WHERE namespace = p_namespace AND kind = p_kind AND id = p_id
      AND (expires_at IS NULL OR expires_at > now())
    RETURNING value INTO consumed;
  RETURN consumed;
END;
$$;
REVOKE ALL ON FUNCTION public.loop_oauth_consume(text, text, text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.loop_oauth_consume(text, text, text) TO service_role;
NOTIFY pgrst, 'reload schema';
