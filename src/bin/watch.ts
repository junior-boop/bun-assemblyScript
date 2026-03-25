#!/usr/bin/env bun
import { startWatcher, startBuild } from "../watcher/index";

const args = process.argv.slice(2);
const command = args[0] || "watch";

if (command === "watch") {
  startWatcher();
} else if (command === "build") {
  startBuild().then(() => process.exit(0));
} else {
  console.log("Usage: bun-as [watch|build]");
  process.exit(1);
}
