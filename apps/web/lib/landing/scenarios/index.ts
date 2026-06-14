import { deepThought } from "./deepThought";
import { delorean } from "./delorean";
import { hogwarts } from "./hogwarts";
import { ring } from "./ring";
import type { DemoScenario } from "./types";
import { wonka } from "./wonka";

export const demoScenarios: DemoScenario[] = [
  ring,
  hogwarts,
  delorean,
  deepThought,
  wonka,
];

export function getScenario(id?: string): DemoScenario {
  const match = id ? demoScenarios.find((scenario) => scenario.id === id) : undefined;
  if (match) return match;
  return demoScenarios[Math.floor(Math.random() * demoScenarios.length)]!;
}
