function readFileAsDataUrl(file: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("File could not be read."));
    reader.readAsDataURL(file);
  });
}

function audioBufferToWavBlob(buffer: AudioBuffer, frameCount: number) {
  const channels = Math.max(1, Math.min(buffer.numberOfChannels, 2));
  const sampleRate = buffer.sampleRate;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frameCount * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);
  let offset = 0;

  const writeString = (value: string) => {
    for (let index = 0; index < value.length; index += 1) {
      view.setUint8(offset, value.charCodeAt(index));
      offset += 1;
    }
  };

  writeString("RIFF");
  view.setUint32(offset, 36 + dataSize, true); offset += 4;
  writeString("WAVE");
  writeString("fmt ");
  view.setUint32(offset, 16, true); offset += 4;
  view.setUint16(offset, 1, true); offset += 2;
  view.setUint16(offset, channels, true); offset += 2;
  view.setUint32(offset, sampleRate, true); offset += 4;
  view.setUint32(offset, sampleRate * blockAlign, true); offset += 4;
  view.setUint16(offset, blockAlign, true); offset += 2;
  view.setUint16(offset, 16, true); offset += 2;
  writeString("data");
  view.setUint32(offset, dataSize, true); offset += 4;

  const channelData = Array.from({ length: channels }, (_, channel) => buffer.getChannelData(channel));
  for (let frame = 0; frame < frameCount; frame += 1) {
    for (let channel = 0; channel < channels; channel += 1) {
      const sample = Math.max(-1, Math.min(1, channelData[channel][frame] || 0));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([view], { type: "audio/wav" });
}

export async function trimAudioFileToDataUrl(file: File, maxSeconds: number) {
  const AudioContextClass =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error("This browser cannot trim audio before upload. Please use a modern browser or upload a shorter file.");
  }

  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await file.arrayBuffer());
    if (decoded.duration <= maxSeconds + 0.05) {
      return {
        dataUrl: await readFileAsDataUrl(file),
        originalSeconds: decoded.duration,
        outputSeconds: decoded.duration,
        trimmed: false
      };
    }

    const frameCount = Math.max(1, Math.min(decoded.length, Math.floor(maxSeconds * decoded.sampleRate)));
    const wavBlob = audioBufferToWavBlob(decoded, frameCount);
    return {
      dataUrl: await readFileAsDataUrl(wavBlob),
      originalSeconds: decoded.duration,
      outputSeconds: frameCount / decoded.sampleRate,
      trimmed: true
    };
  } finally {
    void context.close();
  }
}

export function formatSeconds(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0s";
  return `${value.toFixed(value >= 10 ? 0 : 1)}s`;
}

export function readAudioDurationFromUrl(url: string) {
  return new Promise<number>((resolve, reject) => {
    const audio = document.createElement("audio");
    const timer = window.setTimeout(() => {
      audio.src = "";
      reject(new Error("Audio length could not be verified."));
    }, 8000);

    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = audio.duration;
      audio.src = "";
      if (Number.isFinite(duration) && duration > 0) resolve(duration);
      else reject(new Error("Audio length could not be verified."));
    };
    audio.onerror = () => {
      window.clearTimeout(timer);
      audio.src = "";
      reject(new Error("Audio length could not be verified."));
    };
    audio.src = url;
  });
}
