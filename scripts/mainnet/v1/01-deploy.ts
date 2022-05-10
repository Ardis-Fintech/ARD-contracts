import { ethers, upgrades } from "hardhat";
const { writeFileSync } = require('fs');
const config = require("./config.json");

/* 
This will deploy the below contracts: 
  - The logic contract which is known as the implementation contract containing the logic.
  - A ProxyAdmin to be the admin of the proxy.
  - A proxy to the implementation contract, which is the contract that we actually interact with.
  - transfer the ownership to gnosis safe address
*/
async function deployARDToken() {
  // check whether it is already deployed or not
  if (config.deployed) {
    throw new Error("already deployed");
  }
  // check gnosis safe address
  const gnosisSafe = config.gnosisSafe;
  if (!gnosisSafe) {
    throw new Error("gnosis safe address is not set in config file");
  }
  // initiate contract factory
  const ARD = await ethers.getContractFactory("StakingTokenV1");
  // deploying
  console.log("deploying upgradeable ARD...");
  const ard = await upgrades.deployProxy(
    ARD,
    ["Ardis USD", "ARD", gnosisSafe],
    {
      initializer: "initialize",
    }
  );
  await ard.deployed();
  console.log("ARD deployed to:", ard.address);

  // update config.json
  config.deployed = true;
  config.proxy = ard.address;
  config.deployTransaction = ard.deployTransaction;

  writeFileSync(
    "scripts/mainnet/v1/config.json", 
    JSON.stringify(config, null, 2), 
    "utf8"
  );
  // log the owner
  const owner = await ard.owner();
  console.log("owner: ", owner);
}

deployARDToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
