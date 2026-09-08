-- For databases that already applied add-referrals.sql before the reward change.
-- Future bindings only; existing reward snapshots and account balances are untouched.
UPDATE referral_settings SET inviter_credits=100,invitee_credits=100 WHERE id=1;
ALTER TABLE referral_settings ALTER COLUMN inviter_credits SET DEFAULT 100;
ALTER TABLE referral_settings ALTER COLUMN invitee_credits SET DEFAULT 100;
