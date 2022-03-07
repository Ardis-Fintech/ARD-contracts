import { assert, expect } from "chai";
import { ethers, upgrades, network } from "hardhat";

// const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TOKEN_BANK_ADDRESS = "0x83E79f1E007fF061D593055BE6c555e87ECaee83";

const timeTravel = async (_days: number) => {
  const timeTravelInDays = _days * 24 * 60 * 60;
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  await ethers.provider.send('evm_increaseTime', [timeTravelInDays]);
  await ethers.provider.send('evm_mine', []);
  const blockNumAfter = await ethers.provider.getBlockNumber();
  const blockAfter = await ethers.provider.getBlock(blockNumAfter);
  const timestampAfter = blockAfter.timestamp;
  return timestampAfter === timestampBefore + timeTravelInDays;
};

// Test that ARD operates correctly as an ERC20Basic token.
describe("ARD Staking protocol", function () {
  beforeEach(async function () {
    const [owner, minter, burner, supplyController, user1, user2] = await ethers.getSigners();
    // console.log("owner: ", owner.address);

    const ARD = await ethers.getContractFactory("StakingToken");
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD"]);
    await instance.deployed();

    await instance.setTokenBank(TOKEN_BANK_ADDRESS);
    const tokenBank = await instance.getTokenBank();
    assert.equal(tokenBank, TOKEN_BANK_ADDRESS);
    // console.log("deployed");

    await instance.setMinterRole(minter.address);
    await instance.setBurnerRole(burner.address);
    await instance.setSupplyControllerRole(supplyController.address);
    // console.log("roles assigned");

    // mint 1000 ARDs for user1
    await instance.connect(minter).mint(user1.address, 100000000000);

    // mint 500 ARDs for user2
    await instance.connect(minter).mint(user2.address, 100000000000);

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
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);
      // check total staked in contract
      const totalStaked = await this.token.totalStakes();
      assert.equal(totalStaked, 10000000000);
      // stake another 100 ARDs for user1
      await this.token.connect(this.user1).stake(10000000000, 60);

      const stakes = await this.token.stakes(this.user1.address);
      assert.equal(stakes.length, 2);

      // check total stake of the user
      const userStaked2 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked2, 20000000000);
      // check user balance
      const userNewBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userNewBal, 80000000000);
      // check total staked in contract
      const totalStakedAfterNewStake = await this.token.totalStakes();
      assert.equal(totalStakedAfterNewStake, 20000000000);

      // unstake 100 ARDs for user1
      await this.token.connect(this.user1).unstake(1, 10000000000);
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 10000000000);

      // check user new balance
      const userNewBalAfterUnstake = await this.token.balanceOf(this.user1.address);
      assert.equal(userNewBalAfterUnstake, 89900000000);

      // the last stake record should be removed now
      const newStakesAfterUnstake = await this.token.stakes(this.user1.address);
      assert.equal(newStakesAfterUnstake.length, 1);

      // check total staked in contract
      const totalStakedAfterNewUnstake = await this.token.totalStakes();
      assert.equal(totalStakedAfterNewUnstake, 10000000000);
    });

    it("test rewards after completing lock period", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // let move timestamp and do time travel
      const timeTravelInDays = 30 * 24 * 60 * 60;

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      await ethers.provider.send('evm_increaseTime', [timeTravelInDays]);
      await ethers.provider.send('evm_mine', []);

      const blockNumAfter = await ethers.provider.getBlockNumber();
      const blockAfter = await ethers.provider.getBlock(blockNumAfter);
      const timestampAfter = blockAfter.timestamp;

      expect(blockNumAfter).to.be.equal(blockNumBefore + 1);
      expect(timestampAfter).to.be.equal(timestampBefore + timeTravelInDays);

      // await network.provider.send("evm_setNextBlockTimestamp", [1625097600])
      // await network.provider.send("evm_mine") // this one will have 2021-07-01 12:00 AM as its timestamp, no matter what the previous block has

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 100000000);

      await this.token.connect(this.user1).unstake(1, 10000000000);
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 0);

    });

    it("test punishment after withdraw stake earlier than lock period", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // let move timestamp and do time travel
      const timeTravelInDays = 29 * 24 * 60 * 60;

      const blockNumBefore = await ethers.provider.getBlockNumber();
      const blockBefore = await ethers.provider.getBlock(blockNumBefore);
      const timestampBefore = blockBefore.timestamp;

      await ethers.provider.send('evm_increaseTime', [timeTravelInDays]);
      await ethers.provider.send('evm_mine', []);

      const blockNumAfter = await ethers.provider.getBlockNumber();
      const blockAfter = await ethers.provider.getBlock(blockNumAfter);
      const timestampAfter = blockAfter.timestamp;

      expect(blockNumAfter).to.be.equal(blockNumBefore + 1);
      expect(timestampAfter).to.be.equal(timestampBefore + timeTravelInDays);

      // await network.provider.send("evm_setNextBlockTimestamp", [1625097600])
      // await network.provider.send("evm_mine") // this one will have 2021-07-01 12:00 AM as its timestamp, no matter what the previous block has

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 0);

      await this.token.connect(this.user1).unstake(1, 10000000000);
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 0);

      const userNewBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userNewBal, 99900000000);

      // check token bank balance
      const tokenBankBalance = await this.token.balanceOf(TOKEN_BANK_ADDRESS);
      assert.equal(tokenBankBalance, 100000000);
    });
  });

  describe("test more complicated scenarios for staking rewards and punishments", function () {
    it("test reward after changing rates", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // move timestamp to 10 days later
      await timeTravel(10);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 200);

      // move timestamp again to 10 days later
      await timeTravel(10);

      // set new reward rate after 20 days of staking
      await this.token.setReward(30, 500);

      // move timestamp again to 10 days later
      await timeTravel(10);

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 266666666);

      // await this.token.connect(this.user1).unstake(1, 100);
      // const userCurStaked = await this.token.stakeOf(this.user1.address);
      // assert.equal(userCurStaked, 0);
    });

    it("change rate after staking period shouldn't affect reward", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // move timestamp to 10 days later
      await timeTravel(30);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 200);

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 100000000);

      // await this.token.connect(this.user1).unstake(1, 100);
      // const userCurStaked = await this.token.stakeOf(this.user1.address);
      // assert.equal(userCurStaked, 0);
    });

    it("change rate and check rewards periodically", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // move timestamp to 10 days later
      await timeTravel(10);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 200);

      // unstake 100 ARDs for user1
      let user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 0);

      // move timestamp to 10 days later
      await timeTravel(10);

      // unstake 100 ARDs for user1
      user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 0);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 600);

      // move timestamp to 10 days later
      await timeTravel(10);

      // unstake 100 ARDs for user1
      user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 300000000);
    });

    it("reward won't be added after extra locking time", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // move timestamp to 10 days later
      await timeTravel(10);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 200);

      // move timestamp to 10 days later
      await timeTravel(10);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 600);

      // move timestamp to 10 days later
      await timeTravel(20);

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address);
      assert.equal(user1Reward, 300000000);
    });
  });
});
