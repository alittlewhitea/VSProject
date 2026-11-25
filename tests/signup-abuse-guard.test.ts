import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalizeSignupEmail,
  evaluateSignupBonusPolicy,
  isDisposableSignupEmail,
  isTrustedFreeBonusEmailDomain
} from "../src/lib/signup-abuse-guard";
import {
  getRequestCountryCode,
  signupBonusCreditsForCountry
} from "../src/lib/credits";

test("disposable email guard catches Toboxes, rotating temp domains, and bundled blocklist", () => {
  for (const address of [
    "bot@toboxes.com",
    "u1@sub.toboxes.net",
    "x@my.toboxes.xyz",
    "a@mailpotus.com",
    "b@vedm.pro",
    "c@yxlbyb9g1w.asia",
    "d@mailinator.com",
    "e@sub.guerrillamail.com"
  ]) {
    assert.equal(isDisposableSignupEmail(address), true, `Expected disposable: ${address}`);
  }
  for (const legit of ["alice@gmail.com", "bob@outlook.com", "student@stanford.edu", "founder@acme-studio.io"]) {
    assert.equal(isDisposableSignupEmail(legit), false, `Expected non-disposable: ${legit}`);
  }
});

test("canonicalizeSignupEmail collapses Gmail dots and +aliases", () => {
  assert.equal(canonicalizeSignupEmail("A.l.i.c.e+bot99@googlemail.com"), "alice@gmail.com");
  assert.equal(canonicalizeSignupEmail("alice@gmail.com"), "alice@gmail.com");
  assert.equal(canonicalizeSignupEmail("user+promo@outlook.com"), "user@outlook.com");
  assert.equal(canonicalizeSignupEmail("user+tag@custom-company.io"), "user+tag@custom-company.io");
});

test("missing, unknown, Tor, and spoofed country headers fail closed to 0 signup credits", () => {
  assert.equal(signupBonusCreditsForCountry(null), 0);
  assert.equal(signupBonusCreditsForCountry("US"), 100);
  assert.equal(signupBonusCreditsForCountry("IN"), 15);
  assert.equal(signupBonusCreditsForCountry("CN"), 15);

  assert.equal(getRequestCountryCode(new Headers()), null);
  assert.equal(getRequestCountryCode(new Headers({ "cf-ipcountry": "XX" })), null);
  assert.equal(getRequestCountryCode(new Headers({ "cf-ipcountry": "T1" })), null);
  assert.equal(getRequestCountryCode(new Headers({ "x-country-code": "US" })), null);
  assert.equal(getRequestCountryCode(new Headers({ "cf-ipcountry": "US" })), "US");
});

test("evaluateSignupBonusPolicy gates unknown custom domains on email OTP while preserving Google and trusted providers", () => {
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: null, countryBonusCredits: 0, email: "alice@gmail.com", provider: "google" }).credits,
    0
  );
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: "US", countryBonusCredits: 100, email: "bot@toboxes.com", provider: "email" }).credits,
    0
  );
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: "US", countryBonusCredits: 100, email: "bot@brandnew-burner-999.xyz", provider: "email" }).credits,
    0
  );
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: "US", countryBonusCredits: 100, email: "alice@gmail.com", provider: "email" }).credits,
    100
  );
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: "US", countryBonusCredits: 100, email: "student@mit.edu", provider: "email" }).credits,
    100
  );
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: "US", countryBonusCredits: 100, email: "founder@acme-company.com", provider: "google" }).credits,
    100
  );
  assert.equal(
    evaluateSignupBonusPolicy({ countryCode: "IN", countryBonusCredits: 15, email: "alice@gmail.com", provider: "google" }).credits,
    15
  );
  assert.equal(isTrustedFreeBonusEmailDomain("fixture@example.invalid"), true);
});
