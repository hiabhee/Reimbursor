import path from "path";
import { existsSync } from "fs";
import Tesseract from "tesseract.js";

/**
 * tesseract.js resolves its node worker script relative to its own bundled
 * location (`__dirname`). Under Next.js the library is bundled into
 * `.next/server/...`, so the default relative path points at the nonexistent
 * `.next/worker-script/node/index.js` and `recognize()` hangs/fails.
 *
 * Point the worker at the real file in node_modules instead. Both dev
 * (`next dev`) and prod (`next start`) run from the project directory, so
 * `process.cwd()`-anchored resolution works for both.
 */
function resolveWorkerPath(): string | undefined {
  const candidate = path.join(
    process.cwd(),
    "node_modules",
    "tesseract.js",
    "src",
    "worker-script",
    "node",
    "index.js"
  );
  try {
    if (existsSync(candidate)) return candidate;
  } catch {
    // fall through to default resolution
  }
  return undefined;
}

export async function runTesseractOcr(image: Buffer): Promise<string> {
  const workerPath = resolveWorkerPath();
  const { data } = await Tesseract.recognize(image, "eng", {
    // Suppress Tesseract console output
    logger: () => {},
    ...(workerPath ? { workerPath } : {}),
  });
  return data.text ?? "";
}
