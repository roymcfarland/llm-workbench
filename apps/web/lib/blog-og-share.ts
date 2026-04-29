import type { BlogPost } from "@/lib/blog";

export function formatBlogDateForOg(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function metaLineForOg(post: BlogPost): string {
  const parts = [formatBlogDateForOg(post.date)];
  if (post.updated && post.updated !== post.date) {
    parts.push(`updated ${formatBlogDateForOg(post.updated)}`);
  }
  if (post.author) parts.push(post.author);
  return parts.join(" · ");
}
