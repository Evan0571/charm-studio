-- Existing test orders remain valid; payment details are server-owned.
ALTER TABLE public.charm_orders
  ADD COLUMN IF NOT EXISTS payment jsonb;
ALTER TABLE public.charm_orders
  DROP CONSTRAINT IF EXISTS charm_orders_status_check;
ALTER TABLE public.charm_orders
  ADD CONSTRAINT charm_orders_status_check
    CHECK (status IN ('test_confirmed', 'sandbox_pending', 'sandbox_paid', 'sandbox_failed', 'sandbox_canceled'));
ALTER TABLE public.charm_orders
  DROP CONSTRAINT IF EXISTS charm_orders_payment_check;
ALTER TABLE public.charm_orders
  ADD CONSTRAINT charm_orders_payment_check
    CHECK (payment IS NULL OR jsonb_typeof(payment) = 'object');

ALTER TABLE public.charm_orders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.charm_orders FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.charm_orders TO service_role;
GRANT UPDATE (status, payment) ON public.charm_orders TO service_role;
NOTIFY pgrst, 'reload schema';
