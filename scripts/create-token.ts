import { ethers, upgrades } from "hardhat";

/* 
This will deploy the below contracts: 
  - The logic contract which is known as the implementation contract containing the logic.
  - A ProxyAdmin to be the admin of the proxy.
  - A proxy to the implementation contract, which is the contract that we actually interact with.
*/
async function createARDToken() {
  const ARD = await ethers.getContractFactory("ARDImplementationV1");
  const ard = await upgrades.deployProxy(ARD);
  await ard.deployed();
  console.log("ARD deployed to:", ard.address);
}

createARDToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
