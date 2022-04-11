const { ethers, upgrades } = require("hardhat");
const { writeFileSync } = require('fs');
const config = require("./config.json");

function logInstructions() {
  console.log(`for upgrade using gnosis follow the below instructions:
  1) we need the address of the proxy and the address of the new implementation.
     Proxy Address: ${config.proxy}
     New Implementation Address: ${config.v2_implementation}
  2) in Gnosis Safe website, we use the OpenZeppelin app. 
     In the Apps tab, select the OpenZeppelin application and paste the address of the proxy in the Contract address field, 
     and paste the address of the new implementation in the New implementation address field.
     Note: The app should show that the contract is EIP1967-compatible.
  3) Double check the addresses, and then press the Upgrade button.
     We will be shown a confirmation dialog to Submit the transaction.
  4) We then need to sign the transaction in MetaMask (or the wallet that you are using).
  5) It is done! We can now interact with our upgraded contract.  
  `);
}
async function prepareUpgrade() {
  // check proxy address
  const proxyAddress = config.proxy;
  if (!proxyAddress) {
    throw new Error("can not find proxy address. It seems not deployed yet!");
  }
  // check if the new implementation is already there
  if (config.v2_implementation) {
    console.log("the v2 implementation is already deployed.");
    logInstructions();
    return;
  }
  // get the new version contract
  const StakingTokenV2 = await ethers.getContractFactory("StakingTokenV1");
  const StakingTokenV2Address = await upgrades.prepareUpgrade(proxyAddress, StakingTokenV2);
  console.log(`Staking Token V2 upgrade prepared at: ${StakingTokenV2Address}`);
  // update config
  config.v2_implementation = StakingTokenV2Address;
  writeFileSync(
    "scripts/mainnet/v1/config.json",
    JSON.stringify(config, null, 2),
    "utf8"
  );
  // log the instructions to upgrade using gnosis
  logInstructions();
}

prepareUpgrade().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
