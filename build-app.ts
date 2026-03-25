import { assemblyScriptPlugin } from "./src/plugin";

await Bun.build({
  entrypoints: ["./app.ts"],
  outdir: "./dist",
  plugins: [assemblyScriptPlugin()],
  target: "node",
  minify: true // forces production optimizations
});
console.log("Build OK");
