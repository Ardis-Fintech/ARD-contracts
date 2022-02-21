import { assert, expect } from "chai";
import { ethers, upgrades } from "hardhat";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Test that ARD operates correctly as an ERC20Basic token.
describe("ARD basic functionality", function () {
  beforeEach(async function () {
    const [owner, minter, burner, user1, user2] = await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("ARDImplementationV1");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD"]);
    await instance.deployed();
    // console.log("deployed");

    await instance.setMinterRole(minter.address);
    await instance.setBurnerRole(burner.address);
    // console.log("roles assigned");

    this.token = instance;
    this.owner = owner;
    this.minter = minter;
    this.burner = burner;
    this.user1 = user1;
    this.user2 = user2;
  });

  describe("basic data", function () {
    it("has getters for the name, symbol, and decimals", async function () {
      const name = await this.token.name();
      assert.equal(name, "ArdisToken");
      const symbol = await this.token.symbol();
      assert.equal(symbol, "ARD");
      const decimals = await this.token.decimals();
      assert.equal(decimals, 8);
    });
  });

  describe("total supply", function () {
    it("returns the total amount of tokens", async function () {
      const totalSupply = await this.token.totalSupply();
      const total = totalSupply.toNumber();
      assert.equal(total, 0);
    });
  });

  describe("mint token", function () {
    it("mint a few token for test account", async function () {
      // mint tokens
      await this.token.connect(this.minter).mint(this.user1.address, 500);

      // check supply
      const totalSupply = await this.token.totalSupply();
      assert.equal(totalSupply, 500);

      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 500);
    });
  });

  describe("balanceOf", function () {
    describe("when the requested account has no tokens", function () {
      it("returns zero", async function () {
        const balance = await this.token.balanceOf(this.user1.address);
        assert.equal(balance, 0);
      });
    });

    describe("when the requested account has some tokens", function () {
      it("returns the total amount of tokens", async function () {
        await this.token.connect(this.minter).mint(this.user1.address, 500);
        // check user balance
        const userBal = await this.token.balanceOf(this.user1.address);
        assert.equal(userBal, 500);
      });
    });
  });

  describe("transfer", function () {
    // const to = this.user2.address;
    describe("when the recipient is not the zero address", function () {
      describe("when the sender does not have enough balance", function () {
        const amount = 100;

        it("reverts", async function () {
          await expect(this.token.transfer(this.user2.address, amount)).to.be
            .reverted;
        });
      });

      describe("when the sender has enough balance", function () {
        const amount = 100;

        it("transfers the requested amount", async function () {
          // mint token for user1
          await this.token.connect(this.minter).mint(this.user1.address, 100);
          // send amount from user1 to user2
          await this.token
            .connect(this.user1)
            .transfer(this.user2.address, amount);
          // check new balances
          const senderBalance = await this.token.balanceOf(this.user1.address);
          assert.equal(senderBalance, 0);
          const recipientBalance = await this.token.balanceOf(
            this.user2.address
          );
          assert.equal(recipientBalance, amount);
        });

        it("emits a transfer event", async function () {
          // mint token for user1
          await this.token
            .connect(this.minter)
            .mint(this.user1.address, amount);
          // check logs
          await expect(
            this.token.connect(this.user1).transfer(this.user2.address, amount)
          )
            .to.emit(this.token, "Transfer")
            .withArgs(this.user1.address, this.user2.address, amount);
        });
      });
    });

    describe("when the recipient is the zero address", function () {
      const amount = 100;
      it("reverts", async function () {
        await expect(this.token.transfer(ZERO_ADDRESS, amount)).to.be.reverted;
      });
    });
  });
});
