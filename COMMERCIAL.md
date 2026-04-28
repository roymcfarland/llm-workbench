# Commercial license

LLM Workbench is **dual-licensed** depending on which part of the repository
you are using.

| Path | License | Commercial use |
| --- | --- | --- |
| `packages/runtime` (`@llm-workbench/runtime`) | Apache 2.0 | Free, commercial OK |
| `packages/adapters-react` (`@llm-workbench/adapters-react`) | Apache 2.0 | Free, commercial OK |
| `packages/ai-sdk` (`@llm-workbench/ai-sdk`) | Apache 2.0 | Free, commercial OK |
| `packages/ui` (`@llm-workbench/ui`) | Apache 2.0 | Free, commercial OK |
| `examples/*` | Apache 2.0 | Free, commercial OK |
| `apps/web` (hosted reference deployment) | PolyForm Noncommercial 1.0.0 | Requires paid license |
| Future `apps/*`, `packages/eval`, `packages/marketplace`, `packages/cost-reconciliation` and similar product surfaces | PolyForm Noncommercial 1.0.0 | Requires paid license |

The four core packages and the examples are **OSI-approved open source under
Apache 2.0**. You can read them, fork them, modify them, redistribute them,
and use them in commercial products without any further permission from us.
The Apache 2.0 license includes an explicit patent grant; we expect this
combination of permissive copyright + explicit patent + clear attribution to
be sufficient for almost all integrators.

The hosted reference deployment under `apps/web` and any future
product-surface packages ship under
[PolyForm Noncommercial 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0/).
Under that license you can:

- read, fork, modify, and redistribute the source for **noncommercial** purposes
- use it personally for research, experiments, study, and hobby projects
- use it inside charities, schools, public research organizations, and
  government institutions

If your use of the noncommercial portions is **commercial**, you need a
separate written license from the copyright holder before shipping. The
sections below describe when that applies and how to get one.

## What counts as commercial use of the noncommercial portions

A use of `apps/web` (or any other PolyForm-NC-licensed package in this
repository) is **commercial** if any of the following are true:

1. You or your company derive (or expect to derive) revenue, fees, or
   in-kind compensation from a product, service, internal tool, or hosted
   offering that incorporates the noncommercial portions (in source or
   compiled form), or any substantial part of them.
2. You bundle the noncommercial portions (or anything derived from them)
   into a commercial product, SaaS, or paid distribution.
3. You operate the noncommercial portions as part of revenue-generating
   internal operations of a for-profit entity, including paid R&D and
   consulting engagements.

Public-benefit uses listed in the PolyForm Noncommercial license
(charities, schools, public research, public health/safety, environmental
protection, government) are **not** commercial uses, regardless of funding.

The Apache 2.0-licensed packages above (`@llm-workbench/runtime`,
`@llm-workbench/adapters-react`, `@llm-workbench/ai-sdk`,
`@llm-workbench/ui`) are not affected by any of this. You may use them
commercially under Apache 2.0 with no separate agreement required.

## How to get a commercial license

The copyright holder **retains exclusive rights** to authorize commercial or
proprietary use of PolyForm-covered portions not permitted by the noncommercial
license alone. Agreements are negotiated individually, including participation
by the creator in proceeds (flat fees, per-seat licenses, royalties, revenue
share, or other structures).

- **Email**: open a GitHub Issue titled `commercial license inquiry` on
  this repository, or contact the copyright holder via the email address
  listed on their GitHub profile (https://github.com/roymcfarland).
- Include: company name, intended use case, expected scale (users, runs
  per month), and a primary technical contact.
- The default offer is a paid, perpetual, non-transferable license per
  product or per legal entity. Royalty-bearing terms are also available
  for higher-volume integrations.

Until a written commercial license is signed, **commercial use of the
noncommercial portions is not permitted**, even if a fork is publicly
available.

## Contributions

Contributions are accepted under the
[Developer Certificate of Origin 1.1](https://developercertificate.org/) and
the inbound terms in [`CONTRIBUTING.md`](CONTRIBUTING.md). The inbound
license matches the outbound license of the affected file:

- Contributions to the four Apache-2.0 packages or to `examples/*` come in
  under Apache 2.0 (with patent grant).
- Contributions to `apps/web` or any other PolyForm-NC-licensed area come
  in under PolyForm Noncommercial 1.0.0 plus a relicense grant to the
  Maintainer so that paid commercial licenses can be issued for that
  surface.

## Trademarks

"LLM Workbench" and the project name are not granted to you by any of the
licenses listed above. Trademark rights must be granted in writing.

## No legal advice

This page summarizes the licensing model in plain language. The
controlling terms are the per-package `LICENSE` files, the repository-root
`LICENSE` file, and any signed commercial agreement. If you are unsure
whether your use is commercial, ask before shipping.
