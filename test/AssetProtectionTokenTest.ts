import { expect, assert } from "chai";
import { ethers, upgrades } from "hardhat";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Tests that ARD Asset Protection capabilities function correctly.
describe("ARD Protection Functionalities", function () {
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
    // owner by default is asset protector. So, for our tests, first we revoke his role
    await instance.revokeAssetProtectionRole(owner.address);
    // console.log("roles assigned");

    this.token = instance;
    this.owner = owner;
    this.minter = minter;
    this.burner = burner;
    this.supplyController = supplyController;
    this.protector = protector;
    this.user1 = user1;
    this.user2 = user2;
  });

  describe("when the asset protection role is unset", function () {
    it("reverts asset protection actions", async function () {
      const freezableAddress = this.user1.address;
      await expect(this.token.freeze(freezableAddress)).to.be.reverted;
      await expect(this.token.unfreeze(freezableAddress)).to.be.reverted;
      await expect(this.token.wipeFrozenAddress(freezableAddress)).to.be
        .reverted;
    });
  });

  describe("as an asset protectable token", function () {
    beforeEach(async function () {
      await this.token.setAssetProtectionRole(this.protector.address);
    });

    describe("after setting the AssetProtectionRole", function () {
      it("the current asset protection role is set", async function () {
        const currentAssetProtectionRole = await this.token.isAssetProtection(
          this.protector.address
        );
        assert.equal(currentAssetProtectionRole, true);
      });
    });

    describe("freeze", function () {
      it("reverts when sender is not asset protection", async function () {
        await expect(this.token.freeze(this.user1.address)).to.be.reverted;
      });

      it("adds the frozen address", async function () {
        await this.token.connect(this.protector).freeze(this.user1.address);

        const isFrozen = await this.token
          .connect(this.protector)
          .isFrozen(this.user1.address);
        assert.equal(isFrozen, true, "address is frozen");
      });

      it("emits an AddressFrozen event", async function () {
        await expect(
          this.token.connect(this.protector).freeze(this.user1.address)
        )
          .to.emit(this.token, "AddressFrozen")
          .withArgs(this.user1.address);
      });

      describe("when frozen", function () {
        const amount = 100;
        const approvalAmount = 40;

        beforeEach(async function () {
          // give the freezableAddress some tokens
          await this.token
            .connect(this.minter)
            .mint(this.user1.address, amount);

          // approve otherAddress address to take some of those tokens from freezableAddress
          await this.token
            .connect(this.user1)
            .approve(this.user2.address, approvalAmount);

          // approve freezableAddress address to take some of those tokens from otherAddress
          await this.token
            .connect(this.user2)
            .approve(this.user1.address, approvalAmount);

          // freeze freezableAddress
          await this.token.connect(this.protector).freeze(this.user1.address);
        });

        it("reverts when transfer is from frozen address", async function () {
          await expect(
            this.token.connect(this.user1).transfer(this.user2.address, amount)
          ).to.be.reverted;
        });

        it("reverts when transfer is to frozen address", async function () {
          await expect(
            this.token.connect(this.user2).transfer(this.user1.address, amount)
          ).to.be.reverted;
        });

        it("reverts when transferFrom is by frozen address", async function () {
          await expect(
            this.token
              .connect(this.user1)
              .transferFrom(
                this.user2.address,
                this.user2.address,
                approvalAmount
              )
          ).to.be.reverted;
        });

        it("reverts when transferFrom is from frozen address", async function () {
          await expect(
            this.token
              .connect(this.user2)
              .transferFrom(
                this.user1.address,
                this.user2.address,
                approvalAmount
              )
          ).to.be.reverted;
        });

        it("reverts when transferFrom is to frozen address", async function () {
          await expect(
            this.token
              .connect(this.user2)
              .transferFrom(
                this.user2.address,
                this.user1.address,
                approvalAmount
              )
          ).to.be.reverted;
        });

        it("reverts when approve is from the frozen address", async function () {
          await expect(this.token.approve(this.user1.address)).to.be.reverted;
        });

        it("reverts when approve spender is the frozen address", async function () {
          await expect(
            this.token
              .connect(this.user2)
              .approve(this.user1.address, approvalAmount)
          ).to.be.reverted;
        });
      });

      it("reverts when address is already frozen", async function () {
        await expect(this.token.freeze(this.user1.address)).to.be.reverted;

        await this.token.connect(this.protector).freeze(this.user1.address);
        await expect(
          this.token.connect(this.protector).freeze(this.user1.address)
        ).to.be.reverted;
      });
    });

    describe("unfreeze", function () {
      it("reverts when address is already unfrozen", async function () {
        await expect(
          this.token.connect(this.protector).unfreeze(this.user1.address)
        ).to.be.reverted;
      });

      describe("when already frozen", function () {
        beforeEach(async function () {
          await this.token.connect(this.protector).freeze(this.user1.address);
        });

        it("reverts when sender is not asset protection", async function () {
          await expect(
            this.token.connect(this.user2).unfreeze(this.user1.address)
          ).to.be.reverted;
        });

        it("removes a frozen address", async function () {
          await this.token.connect(this.protector).unfreeze(this.user1.address);

          const isFrozen = await this.token
            .connect(this.protector)
            .isFrozen(this.user1.address);
          assert.equal(isFrozen, false, "address is unfrozen");
        });

        it("unfrozen address can transfer again", async function () {
          const amount = 100;

          await this.token.connect(this.protector).unfreeze(this.user1.address);

          await this.token
            .connect(this.supplyController)
            .increaseSupply(amount);
          await this.token
            .connect(this.supplyController)
            .transfer(this.user1.address, amount);

          let balance = await this.token.balanceOf(this.user1.address);
          assert.equal(amount, balance);

          await this.token
            .connect(this.user1)
            .transfer(this.owner.address, amount);

          balance = await this.token.balanceOf(this.user1.address);
          assert.equal(0, balance);
        });

        it("emits an AddressFrozen event", async function () {
          await expect(
            this.token.connect(this.protector).unfreeze(this.user1.address)
          )
            .to.emit(this.token, "AddressUnfrozen")
            .withArgs(this.user1.address);
        });
      });
    });

    describe("wipeFrozenAddress", function () {
      it("reverts when address is not frozen", async function () {
        await expect(
          this.token
            .connect(this.protector)
            .wipeFrozenAddress(this.user1.address)
        ).to.be.reverted;
      });

      describe("when already frozen with assets and approvals", function () {
        const amount = 100;

        beforeEach(async function () {
          // give the freezableAddress some tokens
          await this.token
            .connect(this.minter)
            .mint(this.user1.address, amount);

          await this.token.connect(this.protector).freeze(this.user1.address);
        });

        it("reverts when sender is not asset protection", async function () {
          await expect(
            this.token.connect(this.user2).wipeFrozenAddress(this.user1.address)
          ).to.be.reverted;
        });

        it("wipes a frozen address balance", async function () {
          await this.token
            .connect(this.protector)
            .wipeFrozenAddress(this.user1.address);

          const isFrozen = await this.token
            .connect(this.protector)
            .isFrozen(this.user1.address);
          assert.equal(isFrozen, true, "address is still frozen");

          const balance = await this.token.balanceOf(this.user1.address);
          assert.equal(0, balance);
        });

        it("emits an FrozenAddressWiped event", async function () {
          await expect(
            this.token
              .connect(this.protector)
              .wipeFrozenAddress(this.user1.address)
          )
            .to.emit(this.token, "FrozenAddressWiped")
            .withArgs(this.user1.address)
            .to.emit(this.token, "SupplyDecreased")
            .withArgs(this.user1.address, amount)
            .to.emit(this.token, "Transfer")
            .withArgs(this.user1.address, ZERO_ADDRESS, amount);
        });
      });
    });

    describe("setAssetProtectionRole", function () {
      it("reverts if sender is not owner or AssetProtectionRole", async function () {
        await expect(
          this.token
            .connect(this.user1)
            .setAssetProtectionRole(this.user1.address)
        ).to.be.reverted;
      });

      it("works if sender is AssetProtectionRole", async function () {
        await this.token.setAssetProtectionRole(this.user2.address);

        const currentAssetProtectionRole = await this.token.isAssetProtection(
          this.protector.address
        );
        assert.equal(currentAssetProtectionRole, true);
        const notAssetProtectionRole = await this.token.isAssetProtection(
          this.user1.address
        );
        assert.equal(notAssetProtectionRole, false);
      });

      it("enables new AssetProtectionRole to freeze", async function () {
        await this.token.setAssetProtectionRole(this.user2.address);
        await this.token.connect(this.user2).freeze(this.user1.address);
        const isFrozen = await this.token
          .connect(this.protector)
          .isFrozen(this.user1.address);
        assert.equal(isFrozen, true, "address is frozen");
      });

      it("prevents old AssetProtectionRole from freezing", async function () {
        await this.token.revokeAssetProtectionRole(this.protector.address);
        await expect(
          this.token.connect(this.protector).freeze(this.user1.address)
        ).to.be.reverted;
      });

      it("emits a AssetProtectionRoleSet event", async function () {
        await expect(this.token.setAssetProtectionRole(this.user1.address))
          .to.emit(this.token, "RoleGranted")
          .withArgs(
            this.token.ASSET_PROTECTION_ROLE,
            this.user1.address,
            this.owner.address
          );
      });
    });
  });
});
