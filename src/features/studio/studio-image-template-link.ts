export function studioImageTemplateHref(item: { id: string; imageUrl: string }, prompt: string) {
  return `/studio?${new URLSearchParams({ mode: "image", workflow: "image-to-image", reference: item.imageUrl, templateId: item.id, prompt }).toString()}`;
}

export function focusStudioTemplateReference(imageUrl: string) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const query = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/studio" && query.get("mode") === "image" && query.get("workflow") === "image-to-image" && query.get("reference") === imageUrl) {
      document.querySelector<HTMLElement>("[data-reference-panel]")?.focus({ preventScroll: true });
    }
  }));
}
