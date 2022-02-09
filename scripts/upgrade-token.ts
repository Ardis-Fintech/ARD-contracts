import { ethers, upgrades } from "hardhat";

const ARD_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

/*
Upgrade then involves the following steps:
  - Deploy the new implementation contract.
  - Send a transaction to the proxy that updates its implementation address to the new one.
*/
async function upgradeARDToken() {
  const ARD = await ethers.getContractFactory("ARDImplementationV1");
  await upgrades.upgradeProxy(ARD_ADDRESS, ARD);
  console.log("ARD upgraded");
}

upgradeARDToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
