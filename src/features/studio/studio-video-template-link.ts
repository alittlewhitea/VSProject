export function studioVideoTemplateHref(item: { id: string; videoUrl: string }, prompt: string) {
  return `/studio?${new URLSearchParams({mode:"video",workflow:"reference-to-video",provider:"heygen-video",referenceVideo:item.videoUrl,templateId:item.id,prompt,duration:"5s",resolution:"768p",ratio:"adaptive"}).toString()}`;
}

export function focusStudioVideoReference(videoUrl: string) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const query = new URLSearchParams(window.location.search);
    if (window.location.pathname === "/studio" && query.get("workflow") === "reference-to-video" && query.get("referenceVideo") === videoUrl) {
      document.querySelector<HTMLElement>("[data-video-reference-panel]")?.focus({preventScroll:true});
    }
  }));
}
