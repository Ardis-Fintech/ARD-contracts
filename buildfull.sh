#! /bin/bash

#contracts
ERC20_ARD_V1=StakingTokenV1.sol

#output folder
OUTPUT=full

#build full contract
mkdir full
npx hardhat flatten contracts/v1/$ERC20_ARD_V1 > $OUTPUT/$ERC20_ARD_V1