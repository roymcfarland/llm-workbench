import type { Metadata } from "next";

import { PlaygroundClient } from "@/components/playground-client";

export const metadata: Metadata = {
  title: "Playground · LLM Workbench",
};

export default function PlaygroundPage() {
  return <PlaygroundClient />;
}
