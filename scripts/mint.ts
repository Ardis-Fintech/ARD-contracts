import { ethers, upgrades } from "hardhat";

const ARD_ADDRESS = "0xfABBFfE09944C0E5288d835d7fA860628F47F62C";

/*
Upgrade then involves the following steps:
  - Deploy the new implementation contract.
  - Send a transaction to the proxy that updates its implementation address to the new one.
*/
async function mintToken() {
  const ARD = await ethers.getContractFactory("StakingToken");
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
