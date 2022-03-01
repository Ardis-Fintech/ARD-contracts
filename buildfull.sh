#! /bin/bash

#contracts
ERC20_ARD_V1=StakingToken.sol

#output folder
OUTPUT=full

#build full contract
mkdir full
npx hardhat flatten contracts/$ERC20_ARD_V1 > $OUTPUT/$ERC20_ARD_V1