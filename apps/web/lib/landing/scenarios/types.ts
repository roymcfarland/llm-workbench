import type { WorkbenchRuntime } from "@llm-workbench/runtime";

export type DemoScenario = {
  id: string;
  title: string;
  blurb: string;
  build(runtime: WorkbenchRuntime): string;
};
