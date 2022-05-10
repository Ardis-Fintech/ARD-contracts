import { ethers, upgrades } from "hardhat";

const gnosis_multisig_wallet_address = "0x603E5c1eD7A20A14919d6A99d43faAD6FDB1c025"; // for rinkeby network
/* 
This will deploy the below contracts: 
  - The logic contract which is known as the implementation contract containing the logic.
  - A ProxyAdmin to be the admin of the proxy.
  - A proxy to the implementation contract, which is the contract that we actually interact with.
  - transfer the ownership 
*/
async function createARDToken() {
  const ARD = await ethers.getContractFactory("StakingTokenV1");
  // deploy and transfer ownership to multisig GNOSIS wallet
  const ard = await upgrades.deployProxy(ARD, ["Ardis USD", "ARD", gnosis_multisig_wallet_address], {
    initializer: "initialize",
  });
  await ard.deployed();
  console.log("ARD deployed to:", ard.address);
  const owner = await ard.owner();
  console.log("owner: ", owner);
  const transfer_proxy_owner_res = await upgrades.admin.transferProxyAdminOwnership(gnosis_multisig_wallet_address);
  console.log("Proxy ownership transfer res:", transfer_proxy_owner_res);
  console.log("Proxy ownership transferred to:", gnosis_multisig_wallet_address);
}

createARDToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
