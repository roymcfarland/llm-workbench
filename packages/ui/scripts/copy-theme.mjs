#!/usr/bin/env node
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "src", "theme.css");
const dest = resolve(here, "..", "dist", "theme.css");

mkdirSync(dirname(dest), { recursive: true });
copyFileSync(src, dest);
