import { z } from "zod";

const isoDate = z.string().refine((s) => !Number.isNaN(Date.parse(s)), {
  message: "Must be a valid date string",
});

export const blogFrontMatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  /** Publication date (ISO-8601 date or datetime). */
  date: isoDate,
  /** Optional last update for sitemap accuracy. */
  updated: isoDate.optional(),
  author: z.string().min(1).optional(),
  tags: z.array(z.string()).optional().default([]),
  draft: z.boolean().optional().default(false),
});

export type BlogFrontMatter = z.infer<typeof blogFrontMatterSchema>;
