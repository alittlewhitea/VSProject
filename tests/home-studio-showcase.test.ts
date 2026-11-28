import assert from "node:assert/strict";
import { test } from "node:test";
import { locales } from "../src/i18n/routing";
import {
  buildHomeShowcaseStudioHref,
  HOME_SHOWCASE_MODES,
  HOME_SHOWCASE_SLIDES,
  homeStudioShowcaseCopy
} from "../src/components/home-studio-showcase-i18n";

test("HomeStudioShowcase copy resolves across all 16 locales", () => {
  for (const locale of locales) {
    const copy = homeStudioShowcaseCopy(locale);
    assert.ok(copy.eyebrow.trim().length > 0, `${locale} missing eyebrow`);
    assert.ok(copy.titlePrefix.trim().length > 0, `${locale} missing titlePrefix`);
    assert.ok(copy.titleAccent.trim().length > 0, `${locale} missing titleAccent`);
    assert.ok(copy.subtitle.trim().length > 0, `${locale} missing subtitle`);
    assert.ok(copy.submitLabel.trim().length > 0, `${locale} missing submitLabel`);
    assert.equal(copy.pills.length, 4, `${locale} must provide 4 inspiration pills`);
    for (const mode of HOME_SHOWCASE_MODES) {
      assert.ok(copy.modes[mode].trim().length > 0, `${locale} missing mode label ${mode}`);
      assert.ok(copy.placeholders[mode].trim().length > 0, `${locale} missing placeholder ${mode}`);
    }
    for (const slide of HOME_SHOWCASE_SLIDES) {
      assert.ok(copy.slides[slide.key].trim().length > 0, `${locale} missing slide label ${slide.key}`);
    }
  }
});

test("HomeStudioShowcase centers Pet Sing & Dance and builds valid Studio handoff URLs", () => {
  assert.equal(HOME_SHOWCASE_SLIDES.length, 5);
  const center = HOME_SHOWCASE_SLIDES[Math.floor(HOME_SHOWCASE_SLIDES.length / 2)];
  assert.equal(center.key, "pet-sing-dance");
  assert.equal(center.href, "/studio?view=apps&app=pet-sing-dance");
  assert.equal(center.hot, true);

  assert.equal(
    buildHomeShowcaseStudioHref("video", "  Three kittens dancing  "),
    "/studio?mode=video&workflow=text-to-video&prompt=Three+kittens+dancing"
  );
  assert.equal(
    buildHomeShowcaseStudioHref("image", "Perfume bottle"),
    "/studio?mode=image&workflow=text-to-image&prompt=Perfume+bottle"
  );
  assert.equal(
    buildHomeShowcaseStudioHref("avatar", "Launch script"),
    "/studio?mode=avatar&workflow=avatar-video&prompt=Launch+script"
  );
  assert.equal(
    buildHomeShowcaseStudioHref("audio", ""),
    "/studio?mode=audio&workflow=text-to-audio"
  );
});
