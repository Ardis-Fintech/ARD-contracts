# [![ard](/assets/ARD.png)](https://github.com/Ardis-Fintech/ARD-contracts)

# ARD Staking Token
The first carbon-negative cryptocurrency!

Backed 1:1 by solar parks, wind turbines, and everything renewable. Ardis enables anyone to help turn the tide against climate change, and the timing has never been more crucial.

```compile the contracts
npx hardhat compile
```

```clean
npx hardhat clean
```

```test
npx hardhat test
REPORT_GAS=true npx hardhat test
```

```coverage
npx hardhat coverage
```

```deploy
npx hardhat run scripts/create-token.ts
```


# Etherscan verification

```shell
npx hardhat verify --network ropsten DEPLOYED_CONTRACT_ADDRESS
```

# Performance optimizations

For faster runs of your tests and scripts, consider skipping ts-node's type checking by setting the environment variable `TS_NODE_TRANSPILE_ONLY` to `1` in hardhat's environment.
