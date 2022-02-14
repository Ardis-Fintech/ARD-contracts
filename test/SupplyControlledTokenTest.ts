import { expect, assert } from "chai";
import { ethers, upgrades } from "hardhat";
const BN = ethers.BigNumber;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT256 = BN.from("2").pow(BN.from("256")).sub(BN.from("1"));

// Tests that USDP token supply control mechanisms operate correctly.
describe("ARD", function () {
  beforeEach(async function () {
    const [owner, minter, burner, supplyController, protector, user1, user2] = await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("ARDImplementationV1");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD"]);
    await instance.deployed();
    // console.log("deployed");

    await instance.setMinterRole(minter.address);
    await instance.setBurnerRole(burner.address);
    await instance.setSupplyControllerRole(supplyController.address);
    await instance.setAssetProtectionRole(protector.address);
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

  describe("as a supply-controlled token", function () {
    describe("after token creation", function () {
      it("sender should be token owner", async function () {
        const tokenOwner = await this.token.owner();
        assert.equal(tokenOwner, this.owner.address);
      });

      it("sender should be supply controller", async function () {
        const supplyController = await this.token.isSupplyController(this.owner.address);
        assert.equal(supplyController, true);
      });

      it("total supply should be zero", async function () {
        const totalSupply = await this.token.totalSupply();
        assert.equal(totalSupply, 0);
      });

      it("balances should be zero", async function () {
        const ownerBalance = await this.token.balanceOf(this.owner.address);
        assert.equal(ownerBalance, 0);
        const otherBalance = await this.token.balanceOf(this.user1.address);
        assert.equal(otherBalance, 0);
      });
    });

    describe("increaseSupply", function () {
      const amount = 100;

      it("reverts when sender is not supply controller", async function () {
        await expect(this.token.connect(this.user1).increaseSupply(amount)).to.be.reverted;
      });

      it("adds the requested amount", async function () {
        await this.token.increaseSupply(amount);

        const balance = await this.token.balanceOf(this.owner.address);
        assert.equal(balance, amount, "supply controller balance matches");

        const totalSupply = await this.token.totalSupply();
        assert.equal(totalSupply, amount, "total supply matches");
      });

      it("emits a SupplyIncreased and a Transfer event", async function () {
        await expect(this.token.increaseSupply(amount))
          .to.emit(this.token, "SupplyIncreased")
          .withArgs(this.owner.address, amount)
          .to.emit(this.token, "Transfer")
          .withArgs(ZERO_ADDRESS, this.owner.address, amount);
      });

      it("cannot increaseSupply resulting in positive overflow of the totalSupply", async function () {
        // issue a big amount - more than half of what is possible
        const bigAmount = MAX_UINT256;
        await this.token.increaseSupply(bigAmount);
        let balance = await this.token.balanceOf(this.owner.address);
        assert.equal(bigAmount.toString(), balance.toString());
        // send it to another address
        await this.token.transfer(this.user1.address, bigAmount);
        balance = await this.token.balanceOf(this.owner.address);
        assert.equal(0, balance.toNumber());
        // try to issue more than is possible for a uint256 totalSupply
        await expect(this.token.connect(this.owner).increaseSupply(bigAmount)).to.be.reverted;
        balance = await this.token.balanceOf(this.owner.address);
        assert.equal(0, balance.toNumber());
      });
    });

    describe("decreaseSupply", function () {
      const initialAmount = 500;
      const decreaseAmount = 100;
      const finalAmount = initialAmount - decreaseAmount;

      describe("when the supply controller has insufficient tokens", function () {
        it("reverts", async function () {
          await expect(this.token.connect(this.owner).decreaseSupply(decreaseAmount)).to.be.reverted;
        });
      });

      describe("when the supply controller has sufficient tokens", function () {
        // Issue some tokens to start.
        beforeEach(async function () {
          await this.token.increaseSupply(initialAmount)
        });

        it("reverts when sender is not supply controller", async function () {
          await expect(this.token.connect(this.user1).decreaseSupply(decreaseAmount)).to.be.reverted;
        });

        it("removes the requested amount", async function () {
          await this.token.decreaseSupply(decreaseAmount);

          const balance = await this.token.balanceOf(this.owner.address);
          assert.equal(balance, finalAmount, "supply controller balance matches");

          const totalSupply = await this.token.totalSupply();
          assert.equal(totalSupply, finalAmount, "total supply matches")
        });

        it("emits a SupplyDecreased and a Transfer event", async function () {
          await expect(this.token.decreaseSupply(decreaseAmount))
            .to.emit(this.token, "SupplyDecreased")
            .withArgs(this.owner.address, decreaseAmount)
            .to.emit(this.token, "Transfer")
            .withArgs(this.owner.address, ZERO_ADDRESS, decreaseAmount);
        });
      });
    });

    describe("setSupplyController", function () {
      const amount = 100;

      beforeEach(async function () {
        await this.token.setSupplyControllerRole(this.supplyController.address);
      });

      it("reverts if sender is not owner or roles admin", async function () {
        await expect(this.token.connect(this.user1.address).setSupplyControllerRole(this.user1.address)).to.be.reverted;
      });

      it("works if sender is role admin", async function () {
        await this.token.connect(this.owner).setSupplyControllerRole(this.user1.address);
        var currentSupplyController = await this.token.isSupplyController(this.user1.address);
        assert.equal(currentSupplyController, true);
      });

      it("reverts if newSupplyController is address zero", async function () {
        await expect(this.token.setSupplyControllerRole(ZERO_ADDRESS)).to.be.reverted;
      });

      it("enables new supply controller to increase and decrease supply", async function () {
        const currentSupplyController = await this.token.isSupplyController(this.supplyController.address);
        assert.equal(currentSupplyController, true);

        let balance = await this.token.balanceOf(this.supplyController.address);
        assert.equal(balance, 0, "supply controller balance starts at 0");
        let totalSupply = await this.token.totalSupply();
        assert.equal(totalSupply, 0, "total supply starts at 0");

        await this.token.connect(this.supplyController).increaseSupply(amount);
        balance = await this.token.balanceOf(this.supplyController.address);
        assert.equal(balance, amount, "supply controller balance matches");
        totalSupply = await this.token.totalSupply();
        assert.equal(totalSupply, amount, "total supply matches");

        await this.token.connect(this.supplyController).decreaseSupply(amount);
        balance = await this.token.balanceOf(this.supplyController.address);
        assert.equal(balance, 0, "supply controller balance matches");
        totalSupply = await this.token.totalSupply();
        assert.equal(totalSupply, 0, "total supply matches")
      });

      it("emits a RoleGranted event", async function () {
        await expect(this.token.setSupplyControllerRole(this.user1.address))
          .to.emit(this.token, "RoleGranted")
          .withArgs(this.token.SUPPLY_CONTROLLER_ROLE, this.user1.address, this.owner.address);
      });
    });
  });
});
