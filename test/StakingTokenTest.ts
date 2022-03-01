import { assert/*, expect*/ } from "chai";
import { ethers, upgrades } from "hardhat";

// const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// Test that ARD operates correctly as an ERC20Basic token.
describe("ARD Staking functionality", function () {
  beforeEach(async function () {
    const [owner, minter, burner, supplyController, user1, user2] = await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("StakingToken");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD"]);
    await instance.deployed();
    // console.log("deployed");

    await instance.setMinterRole(minter.address);
    await instance.setBurnerRole(burner.address);
    await instance.setSupplyControllerRole(supplyController.address);
    // console.log("roles assigned");

    // mint 1000 ARDs for user1
    await instance.connect(minter).mint(user1.address, 1000);

    // mint 500 ARDs for user2
    await instance.connect(minter).mint(user2.address, 1000);

    this.token = instance;
    this.owner = owner;
    this.minter = minter;
    this.burner = burner;
    this.supplyController = supplyController;
    this.user1 = user1;
    this.user2 = user2;
  });

  describe("basic staking functions", function () {
    it("stake some tokens and check getters", async function () {
      await this.token.connect(this.user1).stake(100, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 900);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 100);
      // check total staked in contract
      const totalStaked = await this.token.totalStakes();
      assert.equal(totalStaked, 100);
      // stake another 100 ARDs for user1
      await this.token.connect(this.user1).stake(100, 60);

      const stakes = await this.token.stakes(this.user1.address);
      assert.equal(stakes.length, 2);

      // check total stake of the user
      const userStaked2 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked2, 200);
      // check user balance
      const userNewBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userNewBal, 800);
      // check total staked in contract
      const totalStakedAfterNewStake = await this.token.totalStakes();
      assert.equal(totalStakedAfterNewStake, 200);

      // unstake 100 ARDs for user1
      await this.token.connect(this.user1).unstake(stakes[stakes.length - 1][1], 100);
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 100);

      // check user new balance
      const userNewBalAfterUnstake = await this.token.balanceOf(this.user1.address);
      assert.equal(userNewBalAfterUnstake, 900);

      // the last stake record should be removed now
      const newStakesAfterUnstake = await this.token.stakes(this.user1.address);
      assert.equal(newStakesAfterUnstake.length, 1);

      // check total staked in contract
      const totalStakedAfterNewUnstake = await this.token.totalStakes();
      assert.equal(totalStakedAfterNewUnstake, 100);
    });
  });
});
