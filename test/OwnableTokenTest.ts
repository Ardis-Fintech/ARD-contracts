import { expect, assert } from "chai";
import { ethers, upgrades } from "hardhat";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Test that USDP operates correctly as an Ownable token.
describe("Ownable ARD", function () {
  beforeEach(async function () {
    const [owner, minter, burner, supplyController, protector, user1, user2] =
      await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("StakingTokenV1");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD", owner.address]);
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

  describe("as an ownable", function () {
    it("should have an owner", async function () {
      let currentOwner = await this.token.owner();
      assert.notStrictEqual(currentOwner, ZERO_ADDRESS);
      assert.strictEqual(currentOwner, this.owner.address);
      await this.token.transferOwnership(this.user1.address);
      currentOwner = await this.token.owner();
      assert.strictEqual(currentOwner, this.user1.address);
    });

    it("should transfer owner if initialize sets new owner", async function () {
      const ARD = await ethers.getContractFactory("StakingTokenV1");
      const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD", this.user1.address]);
      await instance.deployed();
      const currentOwner = await instance.owner();
      assert.strictEqual(currentOwner, this.user1.address);
    });

    // it("should prevent current owner from proposing itself as new owner", async function () {
    //   const currentOwner = await this.token.owner();
    //   assert.strictEqual(currentOwner, this.owner.address);
    //   await expect(this.token.transferOwnership(this.owner.address)).to.be.reverted;
    // });

    it("should prevent non-owners from transferring ownership", async function () {
      const currentOwner = await this.token.owner();
      assert.notStrictEqual(currentOwner, this.user1.address);
      await expect(
        this.token.connect(this.user1).transferOwnership(this.user2.address)
      ).to.be.reverted;
    });

    it("transfer ownership and roles", async function () {
      let currentOwner = await this.token.owner();
      assert.notStrictEqual(currentOwner, this.user1.address);
      await this.token.transferOwnershipAndRoles(this.user1.address);
      currentOwner = await this.token.owner();
      assert.equal(currentOwner, this.user1.address);
      // former owner doesn't have any roles after transfer ownership
      let isMinter = await this.token.isMinter(this.owner.address);
      assert.equal(isMinter, false);
      let isBurner = await this.token.isBurner(this.owner.address);
      assert.equal(isBurner, false);
      let isAssetProtection = await this.token.isAssetProtection(this.owner.address);
      assert.equal(isAssetProtection, false);
      let isSupplyController = await this.token.isSupplyController(this.owner.address);
      assert.equal(isSupplyController, false);
      // new owner has all roles
      isMinter = await this.token.isMinter(this.user1.address);
      assert.equal(isMinter, true);
      isBurner = await this.token.isBurner(this.user1.address);
      assert.equal(isBurner, true);
      isAssetProtection = await this.token.isAssetProtection(this.user1.address);
      assert.equal(isAssetProtection, true);
      isSupplyController = await this.token.isSupplyController(this.user1.address);
      assert.equal(isSupplyController, true);
    });
  });

  // describe("as an initializable token", function () {
  //   it("you should not be able to initialize a second time", async function () {
  //     await expect(this.token.initialize()).to.be.reverted;
  //   });

  //   it("constructor initializes the implementation contract and pauses it to avoid misleading state there", async function () {
  //     const isPaused = await this.token.paused();
  //     assert.strictEqual(isPaused, true);
  //     const currentOwner = this.token.owner();
  //     assert.notStrictEqual(currentOwner, ZERO_ADDRESS);
  //     await assertRevert(this.usdp.initialize());
  //   });
  // });
});
