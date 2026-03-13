import { expect, test } from "bun:test";
import { tempDir } from "harness";

test("standalone HTML inlines code into <script type=\"\">s at their original location", async () => {
  using dir = tempDir("issue-27113-standalone-head-order", {
    "index.html": `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <script src="./setup.js"></script>
  </head>
  <body>
    <pre id="out"></pre>
    <script>
      document.getElementById("out").textContent =
        "greeting: " + window.greeting;
    </script>
  </body>
</html>`,
    "setup.js": `window.greeting = "Hello from setup.js";`,
  });

  const result = await Bun.build({
    entrypoints: [`${dir}/index.html`],
    compile: true,
    target: "browser",
  });

  expect(result.success).toBe(true);
  expect(result.outputs.length).toBe(1);

  const html = await result.outputs[0].text();
  const headCloseIndex = html.indexOf("</head>");
  const bundledScriptIndex = html.indexOf("Hello from setup.js");
  const bodyInlineScriptIndex = html.indexOf(`document.getElementById("out").textContent`);

  expect(headCloseIndex).toBeGreaterThan(-1);
  expect(bundledScriptIndex).toBeGreaterThan(-1);
  expect(bodyInlineScriptIndex).toBeGreaterThan(-1);
  expect(bundledScriptIndex).toBeLessThan(headCloseIndex);
  expect(bundledScriptIndex).toBeLessThan(bodyInlineScriptIndex);
  expect(html).toContain("<script>");
  expect(html).not.toContain('<script type="module">');
  expect(html).not.toMatch(/<\/body>\s*<\/html>\s*<script type="module">/);
});

test("standalone HTML still bundles <script type=\"module\">s into a <script type=\"module\"> before </body>", async () => {
  using dir = tempDir("issue-27113-standalone-head-module-order", {
    "index.html": `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <script type="module" src="./setup.js"></script>
  </head>
  <body>
    <pre id="out"></pre>
    <script>
      document.getElementById("out").textContent =
        "greeting: " + window.greeting; // expect to fail due to module execution order
    </script>
  </body>
</html>`,
    "setup.js": `window.greeting = "Hello from setup.js";`,
  });

  const result = await Bun.build({
    entrypoints: [`${dir}/index.html`],
    compile: true,
    target: "browser",
  });

  expect(result.success).toBe(true);
  expect(result.outputs.length).toBe(1);

  const html = await result.outputs[0].text();
  const headCloseIndex = html.indexOf("</head>");
  const bundledScriptIndex = html.indexOf("hello from module script");
  const bodyInlineScriptIndex = html.indexOf(`document.getElementById("out").textContent = "body inline";`);

  expect(bundledScriptIndex).toBeGreaterThan(headCloseIndex);
  expect(bundledScriptIndex).toBeGreaterThan(bodyInlineScriptIndex);
  expect(html).toContain('<script type="module">');
});
