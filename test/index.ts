import { expect } from "chai";
import { parseBytes32String } from "ethers/lib/utils";
import { ethers, upgrades } from "hardhat";

describe("ERC20 Deployment:", function () {
  it("test token deployment and properties", async () => {
    const [owner] = await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("StakingTokenV1");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD", owner.address]);
    await instance.deployed();

    // check version
    const protocolVersion = await instance.protocolVersion();
    const verStr = parseBytes32String(protocolVersion);
    expect(verStr).to.equal("1.0");

    // const admin = await upgrades.admin.getInstance();
    // console.log(admin.address);

    // check token name
    const tokenName = await instance.name();
    expect(tokenName).to.equal("ArdisToken");

    // check token name
    const tokenSymbol = await instance.symbol();
    expect(tokenSymbol).to.equal("ARD");

    // owner balance should be like {"type":"BigNumber","hex":"0x00"}
    const bal = await instance.balanceOf(owner.address);
    const ownerBalance = ethers.BigNumber.from(bal);
    const ownerETH = ethers.utils.formatEther(ownerBalance);
    expect(ownerETH).to.equal("0.0");
  });
});

describe("Upgradeability:", function () {
  it("test upgrade feature", async () => {
    const [owner] = await ethers.getSigners();
    console.log("owner: ", owner.address);

    const ARD1 = await ethers.getContractFactory("StakingTokenV1");
    const ARD2 = await ethers.getContractFactory("StakingTokenV1");

    const instance = await upgrades.deployProxy(ARD1, ["ArdisToken", "ARD", owner.address]);
    await instance.deployed();
    const upgraded = await upgrades.upgradeProxy(instance.address, ARD2);
    expect(upgraded.address).to.equal(instance.address);
  });
});
