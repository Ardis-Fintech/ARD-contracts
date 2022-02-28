import { expect, assert } from "chai";
import { ethers, upgrades } from "hardhat";

// Test that USDP operates correctly as a Pausable token.
describe("Pausable ARD", function () {
  beforeEach(async function () {
    const [owner, minter, burner, supplyController, protector, user1, user2] =
      await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("StakingToken");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD"]);
    await instance.deployed();
    // console.log("deployed");

    await instance.setMinterRole(minter.address);
    await instance.setBurnerRole(burner.address);
    await instance.setSupplyControllerRole(supplyController.address);
    await instance.setAssetProtectionRole(protector.address);
    // console.log("roles assigned");

    // min 100 tokens for owner
    await instance.connect(minter).mint(owner.address, 100);

    this.token = instance;
    this.owner = owner;
    this.minter = minter;
    this.burner = burner;
    this.supplyController = supplyController;
    this.protector = protector;
    this.user1 = user1;
    this.user2 = user2;
  });

  const amount = 10;

  it("can transfer in non-pause", async function () {
    const paused = await this.token.paused();
    assert.equal(paused, false);
    await this.token.transfer(this.user2.address, amount);
    const balance = await this.token.balanceOf(this.owner.address);
    assert.equal(90, balance);
  });

  it("cannot grant roles in pause", async function () {
    // pause the contract and checks to emit a Pause event
    await this.token.pause();
    const paused = await this.token.paused();
    assert.equal(paused, true);

    await expect(
      this.token.connect(this.owner).setMinterRole(this.user1.address)
    ).to.be.reverted;
    await expect(
      this.token.connect(this.owner).setBurnerRole(this.user1.address)
    ).to.be.reverted;
    await expect(
      this.token.connect(this.owner).setAssetProtectionRole(this.user1.address)
    ).to.be.reverted;
    await expect(
      this.token.connect(this.owner).setSupplyControllerRole(this.user1.address)
    ).to.be.reverted;
  });

  it("cannot transfer in pause", async function () {
    // pause the contract and checks to emit a Pause event
    await expect(this.token.pause())
      .to.emit(this.token, "Paused")
      .withArgs(this.owner.address);
    const paused = await this.token.paused();

    assert.equal(paused, true);
    await expect(
      this.token.connect(this.owner).transfer(this.user1.address, amount)
    ).to.be.reverted;
    const balance = await this.token.balanceOf(this.owner.address);
    assert.equal(100, balance);
  });

  it("cannot approve/transferFrom in pause", async function () {
    await this.token.approve(this.user2.address, amount);
    await this.token.pause();
    await expect(
      this.token.connect(this.owner).approve(this.user2.address, 2 * amount)
    ).to.be.reverted;
    await expect(
      this.token
        .connect(this.user2)
        .transferFrom(this.owner.address, this.user2.address, amount)
    ).to.be.reverted;
  });

  it("should resume allowing normal process after pause is over", async function () {
    await this.token.pause();
    // unpause the contract and checks to emit a Unpause event
    await expect(this.token.unpause())
      .to.emit(this.token, "Unpaused")
      .withArgs(this.owner.address);
    await this.token.transfer(this.user2.address, amount);
    const balance = await this.token.balanceOf(this.owner.address);
    assert.equal(90, balance);
  });

  it("cannot unpause when unpaused or pause when paused", async function () {
    await expect(this.token.connect(this.owner).unpause()).to.be.reverted;
    await this.token.pause();
    await expect(this.token.connect(this.owner).pause()).to.be.reverted;
  });
});
