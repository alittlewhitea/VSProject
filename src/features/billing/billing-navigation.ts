/** Keep the Studio billing view when payment confirmation cleans its URL. */
export function billingNavigationUrl(pathname: string, query = "", embedded = false) {
  const params = new URLSearchParams(query);
  if (embedded && pathname === "/studio") params.set("view", "billing");
  const search = params.toString();
  return search ? `${pathname}?${search}` : pathname;
}
