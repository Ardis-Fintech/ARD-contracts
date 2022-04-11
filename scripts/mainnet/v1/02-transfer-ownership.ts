import { upgrades } from "hardhat";
const config = require("./config.json");

async function transferOwnership() {
  const gnosisSafe = config.gnosisSafe;
  if (!gnosisSafe) {
    throw new Error("gnosis safe address is not set in config file");
  }

  console.log("Transferring ownership of ProxyAdmin...");

  // The owner of the ProxyAdmin can upgrade our contracts
  await upgrades.admin.transferProxyAdminOwnership(gnosisSafe);
  console.log("Transferred ownership of ProxyAdmin to:", gnosisSafe);
}

transferOwnership().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
