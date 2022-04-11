import { ethers, upgrades } from "hardhat";

const ARD_ADDRESS = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

/*
Upgrade then involves the following steps:
  - Deploy the new implementation contract.
  - Send a transaction to the proxy that updates its implementation address to the new one.
*/
async function mintToken() {
  const ARD = await ethers.getContractFactory("StakingTokenV1");
  const ard = await ARD.attach(ARD_ADDRESS);
  console.log("ARD attached: ", ard.address);
  const owner = await ard.owner();
  console.log("owner: ", owner);

  const res = await ard.mint(owner, 100000000000);
  console.log("mint res: ", res);
}

mintToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
