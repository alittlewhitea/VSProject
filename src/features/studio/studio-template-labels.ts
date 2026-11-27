export function studioTemplateCategoryLabel(translate: (key: string) => string, category: string) {
  if (category === "shorts") return "Shorts";
  if (category === "pet-sing-dance") return "Pet Sing & Dance";
  return translate(category === "all" ? "studio.gallery.category.all" : `studio.templates.category.${category}`);
}
