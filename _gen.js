const fs = require("fs");
const content = fs.readFileSync("C:/repos/velora-app/_examples_content.txt", "utf8");
fs.writeFileSync("C:/repos/velora-app/packages/ai/src/signatures/examples.ts", content);
console.log("Done");
