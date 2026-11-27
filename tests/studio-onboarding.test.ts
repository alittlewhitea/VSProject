import assert from "node:assert/strict";
import { test } from "node:test";
import { locales } from "../src/i18n/routing";
import { authDialogCopy } from "../src/components/auth-dialog-copy";
import {
  shouldShowWelcomeModal,
  studioOnboardingCopy,
  welcomeSeenStorageKey
} from "../src/features/studio/studio-onboarding-i18n";

test("Studio onboarding and auth dialog starter badges resolve across all 16 locales", () => {
  for (const locale of locales) {
    const onboarding = studioOnboardingCopy(locale);
    assert.ok(onboarding.guestBadge.trim().length > 0, `${locale} missing guestBadge`);
    assert.ok(onboarding.guestText.trim().length > 0, `${locale} missing guestText`);
    assert.ok(onboarding.guestCta.trim().length > 0, `${locale} missing guestCta`);
    assert.ok(onboarding.authPetTitle.trim().length > 0, `${locale} missing authPetTitle`);
    assert.ok(onboarding.welcomeTitle.trim().length > 0, `${locale} missing welcomeTitle`);
    assert.ok(onboarding.welcomeCardPetTitle.trim().length > 0, `${locale} missing welcomeCardPetTitle`);

    const auth = authDialogCopy(locale);
    assert.ok(auth.starterBadge.trim().length > 0, `${locale} missing starterBadge`);
  }
});

test("shouldShowWelcomeModal triggers only once for brand-new signed-in users without active tasks", () => {
  const base = {
    authReady: true,
    signedIn: true,
    userId: "user-123",
    creditBalance: 100,
    taskCount: 0,
    suppressed: false,
    alreadySeen: false
  };

  assert.equal(shouldShowWelcomeModal(base), true);
  assert.equal(shouldShowWelcomeModal({ ...base, creditBalance: 0 }), true);
  assert.equal(shouldShowWelcomeModal({ ...base, authReady: false }), false);
  assert.equal(shouldShowWelcomeModal({ ...base, signedIn: false }), false);
  assert.equal(shouldShowWelcomeModal({ ...base, creditBalance: null }), false);
  assert.equal(shouldShowWelcomeModal({ ...base, taskCount: 1 }), false);
  assert.equal(shouldShowWelcomeModal({ ...base, suppressed: true }), false);
  assert.equal(shouldShowWelcomeModal({ ...base, alreadySeen: true }), false);
  assert.equal(welcomeSeenStorageKey("user-123"), "dreamface_welcome_seen:user-123");
});
