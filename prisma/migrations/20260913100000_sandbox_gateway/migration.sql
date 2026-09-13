-- A gateway that takes no money, so the card path can be walked end to end:
-- redirect to a hosted page, return, a signed callback, capture, refund.
-- Off unless PAYMENT_SANDBOX=1; a real adapter is written against the same
-- interface and added to this enum the same way.
ALTER TYPE "PaymentProvider" ADD VALUE 'sandbox';
