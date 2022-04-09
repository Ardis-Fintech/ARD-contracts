import { ethers, upgrades } from "hardhat";

/* 
This will deploy the below contracts: 
  - The logic contract which is known as the implementation contract containing the logic.
  - A ProxyAdmin to be the admin of the proxy.
  - A proxy to the implementation contract, which is the contract that we actually interact with.
*/
async function createARDToken() {
  const [owner] = await ethers.getSigners();
  const ARD = await ethers.getContractFactory("StakingTokenV1");
  const ard = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD", owner.address], {
    initializer: "initialize",
  });
  await ard.deployed();
  console.log("ARD deployed to:", ard.address);
  const curOwner = await ard.owner();
  console.log("owner: ", curOwner);
}

createARDToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
