// data-agent/packages/agent-loop/jest.config.mjs
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default {
  testEnvironment: "node",
  extensionsToTreatAsEsm: [".ts"],
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  transform: {
    "^.+\\.tsx?$": [
      path.join(__dirname, "../../node_modules/ts-jest"),
      { useESM: true },
    ],
  },
};
