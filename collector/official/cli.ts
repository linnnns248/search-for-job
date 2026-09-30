import { collectOfficialSources } from "./runner";

try {
  const result = await collectOfficialSources();
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}

