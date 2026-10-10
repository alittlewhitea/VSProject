# Model upgrades

- ElevenLabs: `elevenlabs/tts/eleven-v4-turbo`, $0.04/1,000 characters (previous fallback $0.10, 60% lower). 1,000 characters now estimates 10 credits rather than 25. Maximum 5,000 characters; MP3 output, voice, stability, language, normalization and timestamps preserved. Avatar-generated voice uses the same endpoint.
- Nano Banana: `google/nano-banana-2.1` and `google/nano-banana-2.1/edit`. 1K/2K/4K, medium thinking by default; old 0.5K requests normalize to 1K. Existing provider IDs are preserved.
- Image pricing: input text/image $1.764/M tokens; thinking output $8.823/M; image output $35.294/M. Output reserves of 1,120/1,680/2,520 tokens for 1K/2K/4K are application estimates, not official canonical token counts. UTF-8 prompt estimate and reference/thinking reserves are included. Actual supplier cost can differ; no fixed price decrease is claimed.
- These upgraded endpoints no longer read legacy `FAL_MODEL_IMAGE_NANO_BANANA`, `FAL_MODEL_IMAGE_NANO_BANANA_EDIT`, or `FAL_MODEL_AUDIO_ELEVENLABS` overrides, preventing stale deployment settings from selecting old models. Keep `FAL_KEY`; no database migration required.
- Verify with `node scripts/verify-model-upgrades.mjs` and `npm run check`. No paid generations are made by verification.
