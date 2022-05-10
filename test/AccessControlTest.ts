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
    const instance = await upgrades.deployProxy(ARD, ["Ardis USD", "ARD", owner.address]);
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

  describe("ownership", function () {
    it("check the owner account", async function () {
      const currentOwner = await this.token.owner();
      assert.notStrictEqual(currentOwner, ZERO_ADDRESS);
      assert.strictEqual(currentOwner, this.owner.address);
    });

    it("check the owner transfership", async function () {
      await this.token.transferOwnership(this.user1.address);
      const currentOwner = await this.token.owner();
      assert.strictEqual(currentOwner, this.user1.address);
    });

    it("should prevent non-owners from transferring ownership", async function () {
      const currentOwner = await this.token.owner();
      assert.notStrictEqual(currentOwner, this.user1.address2);
      await expect(
        this.token.connect(this.user1).transferOwnership(this.user2.address)
      ).to.be.reverted;
    });
  });

  describe("super admin and admin roles ", function () {
    it("owner should be default super admin and admin", async function () {
      const currentSuperAdmin = await this.token.superAdmin();
      assert.strictEqual(currentSuperAdmin, this.owner.address);
      const isAdmin = await this.token.isAdmin(this.owner.address);
      assert.equal(isAdmin, true);
    });

    it("only owner can transfer super admin", async function () {
      // no one can transfer super admin except owner
      await expect(
        this.token.connect(this.user1).transferSupeAdminTo(this.user2.address)
      ).to.be.reverted;
      // admin also can't transfer super admin
      await this.token.connect(this.owner).setAdminRole(this.user1.address);
      const isAdmin = await this.token.isAdmin(this.user1.address);
      assert.equal(isAdmin, true);
      await expect(
        this.token.connect(this.user1).transferSupeAdminTo(this.user2.address)
      ).to.be.reverted;
      // transfer super admin by owner
      await this.token.connect(this.owner).transferSupeAdminTo(this.user2.address);
      const superAdmin = await this.token.superAdmin();
      assert.equal(superAdmin, this.user2.address);
    });

    it("only super admin can grant/revoke admin", async function () {
      // no one can set admin role  except super admin
      await expect(
        this.token.connect(this.user1).setAdminRole(this.user2.address)
      ).to.be.reverted;
      // super admin cat grant admin role
      await this.token.connect(this.owner).setAdminRole(this.user2.address);
      let isAdmin = await this.token.isAdmin(this.user2.address);
      assert.equal(isAdmin, true);
      // no one can revoke admin role except super admin
      await expect(
        this.token.connect(this.user1).revokeAdminRole(this.user2.address)
      ).to.be.reverted;
      // transfer super admin by owner
      await this.token.connect(this.owner).revokeAdminRole(this.user2.address);
      isAdmin = await this.token.isAdmin(this.user2.address);
      assert.equal(isAdmin, false);
    });

    it("admin can grant and revoke any role", async function () {
      // user1 is not admin, so he can't assign any role
      await expect(
        this.token.connect(this.user1).setMinterRole(this.user2.address)
      ).to.be.reverted;
      await expect(
        this.token.connect(this.user1).setBurnerRole(this.user2.address)
      ).to.be.reverted;
      await expect(
        this.token.connect(this.user1).setAssetProtectionRole(this.user2.address)
      ).to.be.reverted;
      await expect(
        this.token.connect(this.user1).setSupplyControllerRole(this.user2.address)
      ).to.be.reverted;

      // set user1 as admin
      await this.token.connect(this.owner).setAdminRole(this.user1.address);
      const isAdmin = await this.token.isAdmin(this.user1.address);
      assert.equal(isAdmin, true);

      // assign user2 minter role by admin
      let isMinter = await this.token.isMinter(this.user2.address);
      assert.equal(isMinter, false);
      await this.token.connect(this.owner).setMinterRole(this.user2.address);
      isMinter = await this.token.isMinter(this.user2.address);
      assert.equal(isMinter, true);
      await this.token.connect(this.owner).revokeMinterRole(this.user2.address);
      isMinter = await this.token.isMinter(this.user2.address);
      assert.equal(isMinter, false);

      // assign user2 burner role by admin
      let isBurner = await this.token.isBurner(this.user2.address);
      assert.equal(isBurner, false);
      await this.token.connect(this.owner).setBurnerRole(this.user2.address);
      isBurner = await this.token.isBurner(this.user2.address);
      assert.equal(isBurner, true);
      await this.token.connect(this.owner).revokeBurnerRole(this.user2.address);
      isBurner = await this.token.isBurner(this.user2.address);
      assert.equal(isBurner, false);

      // assign user2 Asset Protection role by admin
      let isAssetProtection = await this.token.isAssetProtection(this.user2.address);
      assert.equal(isAssetProtection, false);
      await this.token.connect(this.owner).setAssetProtectionRole(this.user2.address);
      isAssetProtection = await this.token.isAssetProtection(this.user2.address);
      assert.equal(isAssetProtection, true);
      await this.token.connect(this.owner).revokeAssetProtectionRole(this.user2.address);
      isAssetProtection = await this.token.isAssetProtection(this.user2.address);
      assert.equal(isAssetProtection, false);

      // assign user2 Supply Controller role by admin
      let isSupplyController = await this.token.isSupplyController(this.user2.address);
      assert.equal(isSupplyController, false);
      await this.token.connect(this.owner).setSupplyControllerRole(this.user2.address);
      isSupplyController = await this.token.isSupplyController(this.user2.address);
      assert.equal(isSupplyController, true);
      await this.token.connect(this.owner).revokeSupplyControllerRole(this.user2.address);
      isSupplyController = await this.token.isSupplyController(this.user2.address);
      assert.equal(isSupplyController, false);
    });
  });

  describe("granting and revoking events", function () {
    it("granting role will raise RoleGranted event", async function () {
      await expect(this.token.setMinterRole(this.user1.address))
      .to.emit(this.token, "RoleGranted")
      .withArgs(
        this.token.MINTER_ROLE,
        this.user1.address,
        this.owner.address
      );
    });
    it("revoking role will raise RoleRevoked event", async function () {
      await this.token.setMinterRole(this.user1.address);
      await expect(this.token.revokeMinterRole(this.user1.address))
      .to.emit(this.token, "RoleRevoked")
      .withArgs(
        this.token.MINTER_ROLE,
        this.user1.address,
        this.owner.address
      );
    });
  });

});
