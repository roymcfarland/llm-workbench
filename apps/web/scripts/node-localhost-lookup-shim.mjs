/**
 * Preload (--import) for Playwright / `next start` smoke runs.
 *
 * Next.js 16 proxies some middleware traffic to the Node handler using a
 * `http://localhost:<port>/...` target. On hosts where `localhost` does not
 * resolve (ENOTFOUND), that internal hop fails. Rewriting lookups to 127.0.0.1
 * avoids depending on /etc/hosts for the name "localhost".
 *
 * Enable only with LLM_WB_E2E_DNS_SHIM=1 (set from playwright.config / e2e scripts).
 */
import dns from "node:dns";

if (process.env.LLM_WB_E2E_DNS_SHIM === "1") {
  const origLookup = dns.lookup.bind(dns);
  dns.lookup = (hostname, ...args) => {
    const h =
      typeof hostname === "string" && hostname === "localhost"
        ? "127.0.0.1"
        : hostname;
    return origLookup(h, ...args);
  };

  const origPromisesLookup = dns.promises.lookup.bind(dns.promises);
  dns.promises.lookup = (hostname, options) => {
    const h =
      typeof hostname === "string" && hostname === "localhost"
        ? "127.0.0.1"
        : hostname;
    return origPromisesLookup(h, options);
  };
}
