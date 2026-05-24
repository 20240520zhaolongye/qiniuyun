import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";

function startServer(port) {
  const executable = "build/spriteforge_cpp.exe";
  const child = spawn(executable, [], {
    cwd: process.cwd(),
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });

  return child;
}

test("static server serves the app shell and modules", async () => {
  const port = 6187;
  if (!existsSync("build/spriteforge_cpp.exe")) {
    const result = spawnSync("powershell", ["-ExecutionPolicy", "Bypass", "-File", "scripts/build-cpp.ps1"], { encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
  const child = startServer(port);
  const output = [];

  child.stdout.on("data", (chunk) => output.push(chunk.toString("utf8")));
  child.stderr.on("data", (chunk) => output.push(chunk.toString("utf8")));

  try {
    await once(child.stdout, "data");
    const indexResponse = await fetch(`http://127.0.0.1:${port}/`);
    const coreResponse = await fetch(`http://127.0.0.1:${port}/src/core.js`);
    const healthResponse = await fetch(`http://127.0.0.1:${port}/api/health`);
    const apiResponse = await fetch(`http://127.0.0.1:${port}/api/plan`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        request: {
          assetName: "blue slime idle!",
          description: "blue slime",
          assetType: "monster",
          style: "pixel_art",
          size: "32x32",
          view: "side",
          animation: "idle",
          frameCount: 4,
          fps: 8,
          exportTarget: "unity"
        },
        styleProfile: {
          colorPalette: ["#2E5EAA", "#43A047", "#FDD835", "#EF5350", "#FFFFFF", "#172033"],
          lineStyle: "clean dark outline",
          lighting: "simple top-left cel shading",
          worldKeywords: "bright fantasy",
          negativePrompt: "watermark"
        }
      })
    });

    assert.equal(indexResponse.status, 200);
    assert.equal(coreResponse.status, 200);
    assert.equal(healthResponse.status, 200);
    assert.equal(apiResponse.status, 200);
    assert.match(await indexResponse.text(), /SpriteForge/);
    assert.match(await coreResponse.text(), /api\/plan/);
    const plan = await apiResponse.json();
    const health = await healthResponse.json();
    assert.equal(health.service, "SpriteForge C++");
    assert.equal(plan.metadata.assetName, "blue_slime_idle");
    assert.equal(plan.draw.style, "pixel_art");
    assert.equal(plan.draw.lineStyle, "clean dark outline");
    assert.equal(plan.export.files.png, "blue_slime_idle.png");
    assert.match(plan.prompt, /32x32 pixel art/);
  } finally {
    child.kill("SIGTERM");
    await once(child, "exit").catch(() => {});
  }
});
