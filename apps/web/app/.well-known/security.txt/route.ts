import { siteOrigin } from "@/lib/site";

export const dynamic = "force-dynamic";

/** RFC 9116 security.txt — points researchers at private GitHub advisories. */
export async function GET(): Promise<Response> {
  const origin = await siteOrigin();
  const body = `Contact: https://github.com/roymcfarland/llm-workbench/security/advisories/new
Expires: 2027-12-31T23:59:59.000Z
Preferred-Languages: en
Canonical: ${origin}/.well-known/security.txt
`;

  return new Response(body, {
    status: 200,
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
