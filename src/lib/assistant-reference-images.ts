/** Small previews for the existing vision LLM. Never upload original files here. */
export async function assistantReferenceImages(urls: string[]): Promise<string[]> {
  const previews = await Promise.all(urls.slice(0, 2).map(async url => {
    if (/^https:\/\//i.test(url)) return url; // Server validates public addresses.
    if (!/^data:image\/(png|jpeg|webp);base64,/i.test(url)) return null;
    return new Promise<string | null>(resolve => {
      const image = new Image();
      const timer = setTimeout(() => { image.onload = null; image.onerror = null; resolve(null); }, 4000);
      image.onerror = () => { clearTimeout(timer); resolve(null); };
      image.onload = () => {
        clearTimeout(timer);
        try {
          if (!image.width || !image.height) return resolve(null);
          const scale = Math.min(1, 768 / Math.max(image.width, image.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(image.width * scale)); canvas.height = Math.max(1, Math.round(image.height * scale));
          const context = canvas.getContext("2d");
          if (!context) return resolve(null);
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const result = canvas.toDataURL("image/webp", 0.72);
          resolve(result.length <= 350000 ? result : null);
        } catch { resolve(null); }
      };
      image.src = url;
    });
  }));
  return previews.filter((url): url is string => Boolean(url));
}
