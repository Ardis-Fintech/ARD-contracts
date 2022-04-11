import { ethers, upgrades } from "hardhat";

const ARD_CURRENT_VERSION_ADDRESS = "0xCB1992E7307b73318B40C42f9C413EBC0593D127";
/* 
This will deploy the below contracts: 
  - The logic contract which is known as the implementation contract containing the logic.
  - A ProxyAdmin to be the admin of the proxy.
  - A proxy to the implementation contract, which is the contract that we actually interact with.
*/
async function createARDUpgradeTransaction() {
  const [owner] = await ethers.getSigners();
  const ARD = await ethers.getContractFactory("StakingTokenV1");
//   const ard = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD", owner.address], {
//     initializer: "initialize",
//   });
//  await ard.deployed();
  const upgrade_tx = await upgrades.prepareUpgrade(ARD_CURRENT_VERSION_ADDRESS, ARD);
  console.log("upgrade tx:", upgrade_tx);
}

createARDUpgradeTransaction().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
