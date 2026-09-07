export type AppRoute =
  | { name: "home" }
  | { name: "auth" }
  | { name: "review" }
  | { name: "train"; slug?: string }
  | { name: "studies" }
  | { name: "book" };

function hashParts(hash: string): string[] {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const base = String(import.meta.env.BASE_URL ?? "")
    .split("/")
    .filter(Boolean)[0];
  if (base && parts[0] === base) {
    parts.shift();
  }
  return parts;
}

export function parseHash(hash: string): AppRoute {
  const [first, second] = hashParts(hash);
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
  const next = toHash(route);
  if (window.location.hash !== next) {
    window.location.hash = next;
  }
}
