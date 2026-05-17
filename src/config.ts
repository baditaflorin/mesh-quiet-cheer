import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-quiet-cheer",
  description: "Send hearts and claps to a chosen peer — directed positive reactions, mesh-native.",
  accentHex: "#ff5277",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
