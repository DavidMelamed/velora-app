const fs = require("fs");
const lines = [];

lines.push("/**");
lines.push(" * Curated input->output examples for DSPy-style few-shot learning.");
lines.push(" * 20+ examples covering crash types, severities, and personas.");
lines.push(" */");
lines.push("");
lines.push("import type { CrashNarrativeInput, CrashNarrativeOutput } from './crash-narrative'");
lines.push("import type { EqualizerBriefingInput, EqualizerBriefingOutput } from './equalizer-briefing'");
lines.push("import type { PersonaAdapterInput, PersonaAdapterOutput } from './persona-adapter'");
lines.push("");

// Crash narrative examples
lines.push("export const crashNarrativeExamples: Array<{");
lines.push("  input: CrashNarrativeInput");
lines.push("  output: CrashNarrativeOutput");
lines.push("}> = [");

const narratives = [
  {
    input: { stateCode: "CO", crashDate: "2025-01-15", crashTime: "08:30", severity: "SUSPECTEDSERIOUS_INJURY", county: "Denver", city: "Denver", location: "I-25 & 6th Ave", mannerOfCollision: "REAR_END", weatherCondition: "S