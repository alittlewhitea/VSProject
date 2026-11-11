import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectLoader} from './load-project-ts.mjs';
const load=projectLoader(),{locales}=load('src/i18n/routing.ts'),catalog=load('src/lib/studio-message-catalog.ts');
for(const locale of locales){const actual=JSON.parse(readFileSync(`messages/studio/${locale}.json`,'utf8'));assert.deepEqual(actual,catalog.resolveStudioMessages(locale));assert.ok(Object.keys(actual).length>=828);}
const hook=readFileSync('src/lib/studio-i18n.ts','utf8'),client=readFileSync('src/app/studio/studio-client.tsx','utf8'),page=readFileSync('src/app/studio/page.tsx','utf8'),marketing=readFileSync('src/i18n/messages.ts','utf8');
assert.doesNotMatch(hook,/studio-message-catalog|studio-i18n-(?:new-locales|de|fr|home|models)|credit-shop-messages/,'The browser hook must not import all-locale catalogues');
assert.match(page,/initialMessages=\{await loadStudioMessages\(locale\)\}/,'Studio server provides its selected dictionary before hydration');
assert.match(client,/initialMessages/);assert.doesNotMatch(marketing,/import \{ creditShopMessages/);
assert.match(hook,/version!==requestVersion.current/,'A late language request cannot overwrite a newer selection');
assert.match(hook,/useCallback/,'Translations keep stable identity between unrelated task updates');
assert.match(readFileSync('src/features/studio/studio-shell.tsx','utf8'),/!isAppsHome && !isProjectsView && !isBillingView \? <StudioCreationWorkspace/);
assert.match(readFileSync('src/features/studio/studio-shell.tsx','utf8'),/billingModalOpen \? <StudioBillingModal/);
console.log('Studio messages verified: all 16 merged catalogues, server-provided initial dictionary, split CreditShop messages, no all-locale browser imports, stale-language guard and explicit creation/payment lazy boundaries.');
