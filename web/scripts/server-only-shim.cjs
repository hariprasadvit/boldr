// Lets CLI scripts (eval, etc.) import lib/ modules that have `import "server-only"`
// at the top. In Next.js runtime the `react-server` exports condition maps that
// package to empty.js; from a plain Node CLI it tries to load index.js, which
// throws. This shim redirects the require to a no-op stub.
const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");

const stubPath = path.join(__dirname, "server-only-stub.js");
if (!fs.existsSync(stubPath)) {
  fs.writeFileSync(stubPath, "// CLI stub for server-only\nmodule.exports = {};\n");
}

const original = Module._resolveFilename;
Module._resolveFilename = function patched(request, parent, ...rest) {
  if (request === "server-only") return stubPath;
  return original.call(this, request, parent, ...rest);
};
