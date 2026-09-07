export type AppRoute =
  | { name: "home" }
  | { name: "auth" }
  | { name: "review" }
  | { name: "train"; slug?: string }
  | { name: "studies" }
  | { name: "book" };

export function parseHash(hash: string): AppRoute {
  const path = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [first, second] = path;
  if (first === "auth") {
    return { name: "auth" };
  }
  if (first === "review") {
    return { name: "review" };
  }
  if (first === "train") {
    return { name: "train", slug: second };
  }
  if (first === "studies") {
    return { name: "studies" };
  }
  if (first === "book") {
    return { name: "book" };
  }
  return { name: "home" };
}

export function toHash(route: AppRoute): string {
  switch (route.name) {
    case "auth":
      return "#/auth";
    case "review":
      return "#/review";
    case "train":
      return route.slug ? `#/train/${route.slug}` : "#/train";
    case "studies":
      return "#/studies";
    case "book":
      return "#/book";
    default:
      return "#/";
  }
}

export function navigate(route: AppRoute): void {
  window.location.hash = toHash(route);
}
