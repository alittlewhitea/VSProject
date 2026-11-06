export function studioTemplateCategoryLabel(translate: (key: string) => string, category: string) {
  return translate(category === "all" ? "studio.gallery.category.all" : `studio.templates.category.${category}`);
}
