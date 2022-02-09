import { expect } from "chai";
import { ethers, upgrades } from "hardhat";

describe("ARD", function () {
  it("test upgrade feature", async () => {
    const ARD1 = await ethers.getContractFactory("ARDImplementationV1");
    const ARD2 = await ethers.getContractFactory("ARDImplementationV1");

    const instance = await upgrades.deployProxy(ARD1);
    const upgraded = await upgrades.upgradeProxy(instance.address, ARD2);
    console.log(upgraded.address);
    expect(upgraded.address).to.equal(instance.address);
    const admin = await upgrades.admin.getInstance();
    console.log(admin.address);
    // const value = await upgraded.value();
    // expect(value.toString()).to.equal("42");
  });
});
