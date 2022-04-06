import { assert, expect } from "chai";
import { ethers, upgrades, network } from "hardhat";

// const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const TOKEN_BANK_ADDRESS = "0x83E79f1E007fF061D593055BE6c555e87ECaee83";

const timeTravel = async (_days: number) => {
  const timeTravelInDays = _days * 24 * 60 * 60;
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const timestampBefore = blockBefore.timestamp;
  if (_days > 0) {
    await ethers.provider.send('evm_increaseTime', [timeTravelInDays]);
  }
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
    const instance = await upgrades.deployProxy(ARD, ["ArdisToken", "ARD", owner.address]);
    await instance.deployed();

    await instance.setTokenBank(TOKEN_BANK_ADDRESS);
    const tokenBank = await instance.getTokenBank();
    assert.equal(tokenBank, TOKEN_BANK_ADDRESS);
    // console.log("deployed");

    await instance.setMinterRole(minter.address);
    await instance.setBurnerRole(burner.address);
    await instance.setSupplyControllerRole(supplyController.address);
    // console.log("roles assigned");

    // init reward table 
    const _rewards = [
      [30, 100],   // 1.00%
      [60, 200],   // 2.00%
      [90, 200],   // 3.00%
      [150, 200],  // 5.00%
      [180, 200],  // 6.00%
      [360, 200]   // 12.00%
    ];
    await instance.setRewardTable(_rewards);

    // init punishment table 
    const _punishments = [
      [30, 100],   // 1.00%
      [60, 200],   // 2.00%
      [90, 200],   // 3.00%
      [150, 200],  // 5.00%
      [180, 200],  // 6.00%
      [360, 200]   // 12.00%
    ];
    await instance.setPunishmentTable(_punishments);

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
    it("staking and early unstaking are enabled by default", async function () {
      // check the staking protocol enable
      const isProtocolEnabled = await this.token.isStakingProtocolEnabled();
      assert.equal(isProtocolEnabled, true);
      // check the early unstaking protocol enable
      const isEnabled = await this.token.isEarlyUnstakingAllowed();
      assert.equal(isEnabled, true);
    });

    it("stake some tokens and check getters", async function () {
      // check user1 is not stakeholder yet
      let isStakeholder = await this.token.isStakeholder(this.user1.address);
      assert.equal(isStakeholder, false);

      // user1 stake 100 ARDs
      await this.token.connect(this.user1).stake(10000000000, 30);
      let latestStakeValue = await this.token.latest(this.user1.address);
      assert.equal(latestStakeValue, 10000000000);

      // check user1 is stakeholder after stake some ARDs
      isStakeholder = await this.token.isStakeholder(this.user1.address);
      assert.equal(isStakeholder, true);

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
      latestStakeValue = await this.token.latest(this.user1.address);
      assert.equal(latestStakeValue, 10000000000);

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
      // check TVL
      let tvl = await this.token.totalValueLocked();
      assert.equal(tvl, 20000000000);

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
      // check TVL
      tvl = await this.token.totalValueLocked();
      assert.equal(tvl, 10000000000);
    });

    it("stake on same block and same lock period should merge together", async function () {
      // stop auto mining to send transactions on same block 
      await network.provider.send("evm_setAutomine", [false]);

      // user1 stake 100 ARDs
      const staleID1 = await this.token.connect(this.user1).stake(10000000000, 30);

      // stake again in same block (timestamp) and same lock period
      const staleID2 = await this.token.connect(this.user1).stake(20000000000, 30);

      await network.provider.send("evm_mine");
      await network.provider.send("evm_setAutomine", [true]);

      const latestStakeValue = await this.token.latest(this.user1.address);
      assert.equal(latestStakeValue, 30000000000);

      // the last stake record should be merged with previous one
      const newStakes = await this.token.stakes(this.user1.address);
      assert.equal(newStakes.length, 1);
    });

    it("stake and unstake some tokens in behalf of a stakeholder", async function () {
      // check user1 is not stakeholder yet
      let isStakeholder = await this.token.isStakeholder(this.user1.address);
      assert.equal(isStakeholder, false);

      // user1 stake 100 ARDs
      await this.token.connect(this.supplyController).stakeFor(this.user1.address, 10000000000, 30);
      let latestStakeValue = await this.token.latest(this.user1.address);
      assert.equal(latestStakeValue, 10000000000);

      // check user1 is stakeholder after stake some ARDs
      isStakeholder = await this.token.isStakeholder(this.user1.address);
      assert.equal(isStakeholder, true);

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
      await this.token.connect(this.supplyController).stakeFor(this.user1.address, 10000000000, 60);
      latestStakeValue = await this.token.latest(this.user1.address);
      assert.equal(latestStakeValue, 10000000000);

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
      // check TVL
      let tvl = await this.token.totalValueLocked();
      assert.equal(tvl, 20000000000);

      // unstake 100 ARDs for user1
      await this.token.connect(this.supplyController).unstakeFor(this.user1.address, 1, 10000000000);
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
      // check TVL
      tvl = await this.token.totalValueLocked();
      assert.equal(tvl, 10000000000);
    });

    it("only supply controller can stake and unstake in behalf of a stakeholder", async function () {
      // check user1 is not stakeholder yet
      let isStakeholder = await this.token.isStakeholder(this.user1.address);
      assert.equal(isStakeholder, false);

      // the other roles won't be able to stake in behalf of a stakeholder
      await expect(this.token.connect(this.user2).stakeFor(this.user1.address, 10000000000, 30)).to.be.reverted;

      // user1 stake 100 ARDs
      await this.token.connect(this.user1).stake(10000000000, 30);
      let latestStakeValue = await this.token.latest(this.user1.address);
      assert.equal(latestStakeValue, 10000000000);

      // the other roles won't be able to unstake in behalf of a stakeholder
      await expect(this.token.connect(this.user2).unstakeFor(this.user1.address, 1, 10000000000)).to.be.reverted;
    });

    it("can't stake if the staking protocol is disabled", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);

      // disable staking
      await this.token.enableStakingProtocol(false);

      // check the staking protocol enable
      const isEnabled = await this.token.isStakingProtocolEnabled();
      assert.equal(isEnabled, false);

      // users can't use staking any more
      await expect(this.token.connect(this.user1).stake(10000000000, 30)).to.be.reverted;

      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);
    });

    it("can't do early unstaking if the early unstaking is disabled", async function () {

      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);

      // disable early staking
      await this.token.enableEarlyUnstaking(false);

      // check the early unstaking protocol enable
      const isEnabled = await this.token.isEarlyUnstakingAllowed();
      assert.equal(isEnabled, false);

      // users can't unstake before lock period completion
      const stakeID = await this.token.lastStakeID();
      await expect(this.token.connect(this.user1).unstake(stakeID, 5000000000)).to.be.reverted;

      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);
    });

    it("test rewards after completing lock period", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      const stakeID = await this.token.lastStakeID();

      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // let move timestamp and do time travel
      await timeTravel(30);

      // await network.provider.send("evm_setNextBlockTimestamp", [1625097600])
      // await network.provider.send("evm_mine") // this one will have 2021-07-01 12:00 AM as its timestamp, no matter what the previous block has

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 100000000);

      // punishment should be zero
      const user1Punishment = await this.token.punishmentOf(this.user1.address, stakeID);
      assert.equal(user1Punishment, 0);

      await this.token.connect(this.user1).unstake(1, 10000000000);
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 0);
    });

    it("test punishment after withdraw stake earlier than lock period", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      const stakeID = await this.token.lastStakeID();
      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // let move timestamp and do time travel
      await timeTravel(29);

      // await network.provider.send("evm_setNextBlockTimestamp", [1625097600])
      // await network.provider.send("evm_mine") // this one will have 2021-07-01 12:00 AM as its timestamp, no matter what the previous block has

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 0);

      const userPunishment = await this.token.punishmentOf(this.user1.address, stakeID);
      assert.equal(userPunishment, 100000000);

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
      const stakeID = await this.token.lastStakeID();

      // check user balance
      const userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // check rate history getter
      let rewardRateHistory = await this.token.rewardRateHistory(30);
      assert.equal(rewardRateHistory.rates.length, 1);

      // move timestamp to 10 days later
      await timeTravel(10);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 200);

      // check rate history length
      rewardRateHistory = await this.token.rewardRateHistory(30);
      assert.equal(rewardRateHistory.rates.length, 2);

      // move timestamp again to 10 days later
      await timeTravel(10);

      // set new reward rate after 20 days of staking
      await this.token.setReward(30, 500);

      // check rate history length
      rewardRateHistory = await this.token.rewardRateHistory(30);
      assert.equal(rewardRateHistory.rates.length, 3);

      // move timestamp again to 10 days later
      await timeTravel(10);

      // unstake 100 ARDs for user1
      const user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 266666666);

      // await this.token.connect(this.user1).unstake(1, 100);
      // const userCurStaked = await this.token.stakeOf(this.user1.address);
      // assert.equal(userCurStaked, 0);
    });

    it("test punishment after changing rates", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      // check user balance
      let userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 90000000000);
      // check staked amount
      const userStaked1 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked1, 10000000000);

      // check rate history getter
      let punishmentRateHistory = await this.token.punishmentRateHistory(30);
      assert.equal(punishmentRateHistory.rates.length, 1);

      // move timestamp to 10 days later
      await timeTravel(10);

      // set new reward rate after 10 days of staking
      await this.token.setPunishment(30, 200);

      // check rate history length
      punishmentRateHistory = await this.token.punishmentRateHistory(30);
      assert.equal(punishmentRateHistory.rates.length, 2);

      // move timestamp again to 10 days later
      await timeTravel(10);

      // unstake all staked ARDs to check the punishment
      await this.token.connect(this.user1).unstake(1, 10000000000);
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 0);

      // check user balance
      userBal = await this.token.balanceOf(this.user1.address);
      assert.equal(userBal, 99900000000);
    });

    it("change rate after staking period shouldn't affect reward", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      const stakeID = await this.token.lastStakeID();

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
      const user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 100000000);

      // await this.token.connect(this.user1).unstake(1, 100);
      // const userCurStaked = await this.token.stakeOf(this.user1.address);
      // assert.equal(userCurStaked, 0);
    });

    it("change rate and check rewards periodically", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      const stakeID = await this.token.lastStakeID();

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
      let user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 0);

      // move timestamp to 10 days later
      await timeTravel(10);

      // unstake 100 ARDs for user1
      user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 0);

      // set new reward rate after 10 days of staking
      await this.token.setReward(30, 600);

      // move timestamp to 10 days later
      await timeTravel(10);

      // unstake 100 ARDs for user1
      user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 300000000);
    });

    it("reward won't be added after extra locking time", async function () {
      await this.token.connect(this.user1).stake(10000000000, 30);
      const stakeID = await this.token.lastStakeID();

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
      const user1Reward = await this.token.rewardOf(this.user1.address, stakeID);
      assert.equal(user1Reward, 300000000);
    });
  });

  describe("staking permissions", function () {
    it("only supply controller able to set rewards and punishments", async function () {
      // check if supply controller can change the reward rate
      await this.token.connect(this.supplyController).setReward(30, 850);
      const r = await this.token.connect(this.supplyController).rewardRate(30);
      assert.equal(r, 850);

      // check if supply controller can change the punishment rate
      await this.token.connect(this.supplyController).setPunishment(30, 850);
      const p = await this.token.punishmentRate(30);
      assert.equal(p, 850);

      // other roles won't be able to set rewards
      await expect(this.token.connect(this.user1).setReward(30, 200)).to.be.reverted;

      // other roles won't be able to set punishments
      await expect(this.token.connect(this.user1).setPunishment(30, 200)).to.be.reverted;

      // other roles won't be able to set reward table
      await expect(this.token.connect(this.user1).setRewardTable([[30, 200]])).to.be.reverted;

      // other roles won't be able to set punishment table
      await expect(this.token.connect(this.user1).setPunishmentTable([[30, 200]])).to.be.reverted;
    });

    it("only supply controller able to set min stake", async function () {
      // check if supply controller can change the min stake
      await this.token.connect(this.supplyController).setMinimumStake(850);
      const minStake = await this.token.minimumAllowedStake();
      assert.equal(minStake, 850);

      // other roles won't be able to set min stake
      await expect(this.token.connect(this.user1).setMinimumStake(123)).to.be.reverted;
    });

    it("only supply controller able to stop/resume staking protocol", async function () {
      // check if supply controller can change the min stake
      await this.token.connect(this.supplyController).enableStakingProtocol(false);
      let enabled = await this.token.isStakingProtocolEnabled();
      assert.equal(enabled, false);

      // other roles won't be able to set min stake
      await expect(this.token.connect(this.user1).enableStakingProtocol(true)).to.be.reverted;

      // staking still should be disabled
      enabled = await this.token.isStakingProtocolEnabled();
      assert.equal(enabled, false);

      // enable it again
      await this.token.connect(this.supplyController).enableStakingProtocol(true);
      enabled = await this.token.isStakingProtocolEnabled();
      assert.equal(enabled, true);
    });
  });

  // test if stop, no one can do staking
  describe("check protocol start/stop functions", function () {
    it("staking/unstaking are not allowed if protocol is stopped ", async function () {
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

      // stop protocol
      await this.token.enableStakingProtocol(false);

      // stake another 100 ARDs will fails because protocol is stopped
      await expect(this.token.connect(this.user1).stake(10000000000, 60)).to.be.reverted;

      // still must have 1 record
      const stakes = await this.token.stakes(this.user1.address);
      assert.equal(stakes.length, 1);

      // check total stake of the user which is still same as first staking
      const userStaked2 = await this.token.stakeOf(this.user1.address);
      assert.equal(userStaked2, 10000000000);
    });

    it("unstake is not allowed if early unstaking is stopped by owner or supply controller ", async function () {
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

      // stop early unstaking
      await this.token.enableEarlyUnstaking(false);

      // unstake 100 ARDs for user1 would fail
      await expect(this.token.connect(this.user1).unstake(1, 10000000000)).to.be.reverted;
      const userCurStaked = await this.token.stakeOf(this.user1.address);
      assert.equal(userCurStaked, 10000000000);

      // check user new balance must be still same as before unstake tx
      const userNewBalAfterUnstake = await this.token.balanceOf(this.user1.address);
      assert.equal(userNewBalAfterUnstake, 90000000000);
    });
  });
});
