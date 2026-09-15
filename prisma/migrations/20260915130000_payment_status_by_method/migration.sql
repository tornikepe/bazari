-- The sample orders were seeded "unpaid" on every order not yet delivered,
-- whatever it was paid with, and "refunded" on every cancelled one. But a
-- card or transfer order the shop has confirmed or shipped was paid first —
-- that is what confirming it meant — and a cancelled cash order never paid
-- anything, so there was nothing to refund. The seed says so now; this
-- says it about the orders already there.
UPDATE "Order"
SET "paymentStatus" = 'paid'
WHERE "paymentStatus" = 'unpaid'
  AND "status" IN ('confirmed', 'shipped')
  AND "paymentMethod" IN ('card', 'bank_transfer', 'tbc', 'bog', 'paypal', 'crypto');

UPDATE "Order"
SET "paymentStatus" = 'unpaid'
WHERE "paymentStatus" = 'refunded'
  AND "status" = 'cancelled'
  AND "paymentMethod" IN ('cash_on_delivery', 'bank_transfer');
