import * as dotenv from "dotenv";

import { HardhatUserConfig, task } from "hardhat/config";
import "@nomiclabs/hardhat-etherscan";
import "@nomiclabs/hardhat-waffle";
import "@typechain/hardhat";
import "hardhat-gas-reporter";
import "solidity-coverage";
import "@openzeppelin/hardhat-upgrades";
import "@openzeppelin/test-helpers";

// Go to https://www.alchemyapi.io, sign up, create
// a new App in its dashboard, and replace "KEY" with its key
const ALCHEMY_URL =
  "https://eth-ropsten.alchemyapi.io/v2/zSwzhXmsWGHnmd3HkkbIj_le_92xf1mm";

// Replace this private key with your Ropsten account private key
// To export your private key from Metamask, open Metamask and
// go to Account Details > Export Private Key
// Be aware of NEVER putting real Ether into testing accounts

// account_address = "0x6498B57957849ADF69260cEAdC2aDE1ed8953E32";
const ROPSTEN_PRIVATE_KEY =
  "9e1266931ce15d3fa1f533154bc6753a0adf9ff62e3e9b422107c47c06f50ad9";

/*
You can get some ETH for other testnets following these links:
  Ropsten https://faucet.ropsten.be/  
  Kovan   https://faucet.kovan.network/
  Rinkeby https://faucet.rinkeby.io/
  Goerli  https://goerli-faucet.slock.it/
*/

const EtherscanApiKey = "92SPTXK5M6D4AQ4PYFBTIJ4CCTJ9A3UUYG";

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig = {
  // solidity: "0.8.2",
  solidity: {
    version: "0.8.2",
    settings: {
      optimizer: {
        enabled: true,
        runs: 10,
      },
    },
  },
  networks: {
    ropsten: {
      url: process.env.ROPSTEN_URL || ALCHEMY_URL,
      accounts:
        process.env.PRIVATE_KEY !== undefined
          ? [process.env.PRIVATE_KEY]
          : [`${ROPSTEN_PRIVATE_KEY}`],
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || EtherscanApiKey,
  },
};

export default config;
