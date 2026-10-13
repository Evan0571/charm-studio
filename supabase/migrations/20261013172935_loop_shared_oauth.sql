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
