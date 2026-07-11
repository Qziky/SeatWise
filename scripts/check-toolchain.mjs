import { readFileSync } from "node:fs";

const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

function assertMatchingVersions(leftName, leftVersion, rightName, rightVersion) {
  if (leftVersion !== rightVersion) {
    throw new Error(`${leftName} (${leftVersion}) must match ${rightName} (${rightVersion}).`);
  }
}

assertMatchingVersions(
  "next",
  packageJson.dependencies.next,
  "eslint-config-next",
  packageJson.devDependencies["eslint-config-next"]
);
assertMatchingVersions(
  "react",
  packageJson.dependencies.react,
  "react-dom",
  packageJson.dependencies["react-dom"]
);

console.log("Next/ESLint and React package versions are aligned.");
