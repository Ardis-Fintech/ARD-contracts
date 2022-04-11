// for upgrade using gnosis follow the below instructions:
//   1) we need the address of the proxy and the address of the new implementation.
//      Proxy Address: ${config.proxy}
//      New Implementation Address: ${config.v2_implementation}
//   2) in Gnosis Safe website, we use the OpenZeppelin app.
//      In the Apps tab, select the OpenZeppelin application and paste the address of the proxy in the Contract address field, 
//      and paste the address of the new implementation in the New implementation address field.
//      Note: The app should show that the contract is EIP1967-compatible.
//   3) Double check the addresses, and then press the Upgrade button.
//      We will be shown a confirmation dialog to Submit the transaction.
//   4) We then need to sign the transaction in MetaMask (or the wallet that you are using).
//   5) It is done! We can now interact with our upgraded contract.
//

/*
Upgrade then involves the following steps:
  - Deploy the new implementation contract.
  - Send a transaction to the proxy that updates its implementation address to the new one.
*/
async function upgradeARDToken() {
  console.log("upgrade should be handled by gnosis app section.");
  console.log(
    "run script 03-prepare-upgrade-to-v2-gnosis again to see the instructions!"
  );
}

upgradeARDToken().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
