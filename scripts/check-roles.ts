import { ethers, upgrades } from "hardhat";

const ARD_ADDRESS = "0xCB1992E7307b73318B40C42f9C413EBC0593D127";

/*
Upgrade then involves the following steps:
  - Deploy the new implementation contract.
  - Send a transaction to the proxy that updates its implementation address to the new one.
*/

// run script:
// npx hardhat run --network rinkeby scripts/check-roles.ts
async function checkRoles() {
  const ARD = await ethers.getContractFactory("StakingTokenV1");
  const ard = await ARD.attach(ARD_ADDRESS);
  console.log("ARD attached: ", ard.address);
  const owner = await ard.owner();
  console.log("owner: ", owner);

  const addr = "0x904FEe570d40228571c681011Bba21dd3C136311";

  const isMinter = await ard.isMinter(addr);
  console.log("is minter: ", isMinter);

  const isBurner = await ard.isBurner(addr);
  console.log("is burner: ", isBurner);

  const isAssetProtection = await ard.isAssetProtection(addr);
  console.log("is Asset Protection: ", isAssetProtection);

  const isSupplyController = await ard.isSupplyController(addr);
  console.log("is Supply Controller: ", isSupplyController);
}

checkRoles().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
