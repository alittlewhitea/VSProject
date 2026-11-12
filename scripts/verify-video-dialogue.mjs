import assert from 'node:assert/strict';
import { projectLoader } from './load-project-ts.mjs';
const load = projectLoader();
const speech = load('src/lib/video-spoken-script.ts');
const core = load('src/lib/video-prompt-enhancement.ts');

const original = "Hello my love how are you doing today? How was work today I hope you have a wonderful day today I just want to know what's wrong with you but I'm really worried about you";
const broken = 'A medium close-up shot of an affectionate person looking directly into the camera with a gentle, caring, and slightly concerned expression. The subject speaks tenderly directly to the lens, delivering heartfelt words of love and worry, displaying natural facial micro-expressions, subtle head tilts, and authentic lip movements throughout the smooth, continuous five-second scene.';
assert.equal(speech.videoDialogue(original).text, original);
assert.equal(speech.videoDialogue(original).kind, 'standalone');
const timing = speech.videoDialogueTiming(original, '5s');
assert.equal(timing.requiredSeconds, 16);
assert.equal(timing.tooLong, true);
assert.equal(timing.exceedsModelLimit, true);
assert.throws(() => core.parseEnhancementOutput({ output: broken }, original), /lost spoken dialogue/);
assert.throws(() => core.validateEnhancementFidelity(original, broken), /lost spoken dialogue/);
const preserved = 'A single continuous shot with restrained natural expressions. Dialogue: ' + JSON.stringify(original);
assert.equal(core.parseEnhancementOutput({ output: preserved }, original).output, preserved, 'A complete verbatim quote does not need invented terminal punctuation');
assert.throws(() => core.parseEnhancementOutput({ output: preserved.replace("really worried about you", "concerned") }, original), /lost spoken dialogue/);
assert.throws(() => core.parseEnhancementOutput({ output: preserved.replace('Hello my love', 'Bonjour mon amour') }, original), /lost spoken dialogue/);
const context = { mode: 'text-to-video', model: 'heygen-video', prompt: original, duration: '5s', aspectRatio: '16:9', resolution: '480p', generateAudio: true };
const input = core.buildEnhancementInput(context, 'fixture-model');
const data = JSON.parse(input.prompt);
assert.equal(data.userDescription, original);
assert.equal(data.generationContext.spokenDialogue, original);
assert.equal(data.generationContext.estimatedDialogueSeconds, 16);
assert.match(input.system_prompt, /without quotation marks/);
assert.match(input.system_prompt, /verbatim/);
assert.equal(data.generationContext.duration, '5s', 'Enhancement never silently changes duration or credits');
const imageInput = core.buildEnhancementInput({ ...context, mode: 'image-to-video', imageUrls: ['https://fixture.invalid/image.jpg'] }, 'fixture-model');
assert.match(imageInput.system_prompt, /without quotation marks/);
assert.deepEqual(imageInput.image_urls, ['https://fixture.invalid/image.jpg']);

for (const prompt of ['Hello, my love!', 'Bonjour mon amour, comment vas-tu ?', 'Hola mi amor, ¿cómo estás?', '亲爱的，你今天过得怎么样？', '你好，我很想你。', 'こんにちは、お元気ですか？']) {
  assert.equal(speech.videoDialogue(prompt).text, prompt);
  const wrapped = speech.heygenVideoSpokenPrompt(prompt);
  assert.equal(speech.videoDialogue(wrapped).text, prompt, 'Provider input keeps exact original words and language');
  assert.equal(speech.shouldDisableHeygenEnhancement(wrapped), true);
}
for (const prompt of ['A peaceful landscape.', 'An orange cat drinks coffee in a café.', 'Hello Kitty dances.', 'Hello world in glowing 3D text.', 'I want to create a video of a sunrise.', 'Welcome to a cinematic camera shot.', 'A poster reads "Hello, my love!".', 'A shirt that says "Hello, world!".']) {
  assert.equal(speech.videoDialogue(prompt), null, 'Visual prompts and typography are not inferred as dialogue: ' + prompt);
  assert.equal(speech.heygenVideoSpokenPrompt(prompt), prompt);
}
const multiple = 'Alice says: "Hello, everyone." Bob replies: "Welcome home."';
assert.deepEqual(speech.videoDialogue(multiple).segments, ['Hello, everyone.', 'Welcome home.']);
assert.doesNotThrow(() => core.validateEnhancementFidelity(multiple, 'In one steady shot Alice says: "Hello, everyone." Bob replies with a smile: "Welcome home."'));
assert.throws(() => core.validateEnhancementFidelity(multiple, 'Alice says: "Hello, everyone." Bob smiles.'), /lost spoken dialogue|lost quoted text/);
assert.deepEqual(speech.videoDialogue('Dialogue: "First phrase. Tonight is beautiful."\nVoiceover: Second phrase.').segments, ['First phrase. Tonight is beautiful.', 'Second phrase.']);
assert.equal(speech.videoDialogue('Dialogue:\nA camera moves around a lake.'), null);
assert.equal(speech.videoDialogueTiming('Hello, my love!', '5s').tooLong, false);
assert.equal(speech.videoDialogueTiming('Hello my love, how are you doing today?', '5s').tooLong, true);
assert.equal(speech.videoDialogueTiming('Hello my love, how are you doing today?', '10s').tooLong, false);
for (const status of ['enhanced', 'fallback', 'off', 'disabled']) assert.equal(speech.shouldDisableHeygenEnhancement('A peaceful landscape.', { status }), true);
assert.equal(speech.shouldDisableHeygenEnhancement('A peaceful landscape.'), false);

const { locales } = load('src/i18n/routing.ts');
for (const locale of locales) {
  const messages = load('src/lib/studio-message-catalog.ts').resolveStudioMessages(locale);
  assert.ok(messages['studio.videoSpeech.duration'].includes('{required}'));
  assert.ok(messages['studio.videoSpeech.duration'].includes('{selected}'));
  assert.ok(messages['studio.videoSpeech.limit'].includes('{max}'));
}
console.log('Video dialogue passed: exact unquoted-message regression, verbatim/language checks, complete quotes, multiple speakers, safe scene/typography detection, duration estimates, no setting changes, provider rewrite policy and 16 translated warnings. No network or paid generation.');
