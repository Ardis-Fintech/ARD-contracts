// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

import "contracts/ARDImplementationV1.sol";
import "@openzeppelin/contracts/utils/Checkpoints.sol";
import "hardhat/console.sol";

/**
 * @title Staking Token (STK)
 * @author Gheis Mohammadi
 * @dev Implements a staking Protocol using ARD token.
 */
contract StakingToken is ARDImplementationV1 {
    using SafeMath for uint256;
    using SafeMath for uint64;

    /*****************************************************************
    ** STRUCTS & VARIABLES                                          **
    ******************************************************************/
    struct Stake {
        uint256 id;
        uint256 stakedAt; 
        uint256 value;
        uint64  lockPeriod;
    }

    struct StakeHolder {
        uint256 totalStaked;
        Stake[] stakes;
    }

    struct Rate {
        uint256 timestamp;
        uint256 rate;
    }

    struct RateHistory {
        Rate[] rates;
    }

    /*****************************************************************
    ** STATES                                                       **
    ******************************************************************/
    /**
     * @dev token bank for storing the punishments
     */
    address private tokenBank;

    /**
     * @dev start/stop staking
     */
    bool stakingEnabled;
    
    /**
     * @dev The minimum amount of tokens to stake
     */
    uint256 minStake;

    /**
     * @dev staking history
     */
    Checkpoints.History internal totalStakedHistory;

    /**
     * @dev We usually require to know who are all the stakeholders.
     */
    mapping(address => StakeHolder) internal stakeholders;

    /**
     * @dev The reward rate history per locking period
     */
    mapping(uint256 => RateHistory) internal rewardTable;
     /**
     * @dev The punishment rate history per locking period 
     */
    mapping(uint256 => RateHistory) internal punishmentTable;


    /*****************************************************************
    ** MODIFIERS                                                    **
    ******************************************************************/
    modifier onlyActiveStaking() {
        require(stakingEnabled, "staking protocol stopped");
        _;
    }

    /*****************************************************************
    ** EVENTS                                                       **
    ******************************************************************/
    event Staked(address indexed from, uint256 amount, uint256 newStake, uint256 oldStake);
    event Unstaked(address indexed from, uint256 amount, uint256 newStake, uint256 oldStake);

    event RewardRateChanged(uint256 timestamp, uint256 newRate, uint256 oldRate);
    event PunishmentRateChanged(uint256 timestamp, uint256 newRate, uint256 oldRate);
    /*****************************************************************
    ** FUNCTIONALITY                                                **
    ******************************************************************/
    /**
     * This constructor serves the purpose of leaving the implementation contract in an initialized state, 
     * which is a mitigation against certain potential attacks. An uncontrolled implementation
     * contract might lead to misleading state for users who accidentally interact with it.
     */
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        //initialize(name_,symbol_);
        _pause();
    }

    /**
     * @dev initials tokens, roles, staking settings and so on.
     * this serves as the constructor for the proxy but compiles to the
     * memory model of the Implementation contract.
     */
    function initialize(string memory name_, string memory symbol_) public initializer{
        _initialize(name_, symbol_);
        
        // contract can mint the rewards
        setMinterRole(address(this));

        // init reward table   
        setReward(30, 100);   // 1.00%
        setReward(60, 200);   // 2.00%
        setReward(90, 200);   // 3.00%
        setReward(150, 200);  // 5.00%
        setReward(180, 200);  // 6.00%
        setReward(360, 200);  // 12.00%

        // init punishment table
        setPunishment(30, 100);   // 1.00%
        setPunishment(60, 200);   // 2.00%
        setPunishment(90, 200);   // 3.00%
        setPunishment(150, 200);  // 5.00%
        setPunishment(180, 200);  // 6.00%
        setPunishment(360, 200);  // 12.00%

        //enable staking by default
        setEnabled(true);
    }

    /**
     * @dev set token bank account address
     * @param _tb address of the token bank account 
    */
    function setTokenBank(address _tb)
        onlySupplyController
        public
    {
        tokenBank=_tb;
    }
    ///////////////////////////////////////////////////////////////////////
    // STAKING                                                           //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev enable/disable stoking
     * @param _enabled enable/disable
    */
    function setEnabled(bool _enabled)
        onlySupplyController
        public
    {
        stakingEnabled=_enabled;
    }

    /**
     * @dev set the minimum acceptable amount of tokens to stake
     * @param _minStake minimum token amount to stake
    */
    function setMinimumStake(uint256 _minStake)
        onlySupplyController
        public
    {
        minStake=_minStake;
    }

    /**
     * @dev A method for a stakeholder to create a stake.
     * @param _value The size of the stake to be created.
     * @param _lockPeriod the period of lock for this stake
    */
    function stake(uint256 _value, uint64 _lockPeriod)
        public
        returns(uint256)
    {
        return _stake(_msgSender(), _value, _lockPeriod);
    }
    /**
     * @dev A method to create a stake in behalf of a stakeholder.
     * @param _stakeholder address of the stake holder
     * @param _value The size of the stake to be created.
     * @param _lockPeriod the period of lock for this stake
     */
    function stakeFor(address _stakeholder, uint256 _value, uint64 _lockPeriod)
        public
        onlySupplyController
        returns(uint256)
    {
        return _stake(_stakeholder, _value, _lockPeriod);
    }

    /**
     * @dev A method for a stakeholder to remove a stake.
     * @param _stakedID id number of the stake
     * @param _value The size of the stake to be removed.
     */
    function unstake(uint256 _stakedID, uint256 _value)
        public
    {
        _unstake(_msgSender(),_stakedID,_value);
    }

    /**
     * @dev A method for a stakeholder to remove a stake.
     * @param _stakeholder The stakeholder to unstake his tokens.
     * @param _stakedID The unique id of the stake
     * @param _value The size of the stake to be removed.
     */
    function unstakeFor(address _stakeholder, uint256 _stakedID, uint256 _value)
        public
        onlySupplyController
    {
        _unstake(_stakeholder,_stakedID,_value);
    }

    /**
     * @dev A method to retrieve the stake for a stakeholder.
     * @param _stakeholder The stakeholder to retrieve the stake for.
     * @return uint256 The amount of wei staked.
     */
    function stakeOf(address _stakeholder)
        public
        view
        returns(uint256)
    {
        return stakeholders[_stakeholder].totalStaked;
    }

    /**
     * @dev A method to retrieve the stakes for a stakeholder.
     * @param _stakeholder The stakeholder to retrieve the stake for.
     * @return staking history of the stake holder.
     */
    function stakes(address _stakeholder)
        public
        view
        returns(Stake[] memory)
    {
        return(stakeholders[_stakeholder].stakes);
    }

    /**
     * @dev A method to get the aggregated stakes from all stakeholders.
     * @return uint256 The aggregated stakes from all stakeholders.
     */
    function totalStakes()
        public
        view
        returns(uint256)
    {
        return Checkpoints.latest(totalStakedHistory);
    }


    /**
     * @dev Returns the value in the latest stakes history, or zero if there are no stakes.
     * @param _stakeholder The stakeholder to retrieve the latest stake amount.
     */
    function latest(address _stakeholder) internal view returns (uint256) {
        uint256 pos = stakeholders[_stakeholder].stakes.length;
        return pos == 0 ? 0 : stakeholders[_stakeholder].stakes[pos - 1].value;
    }

    /**
     * @dev Pushes a value onto a History so that it is stored as the checkpoint for the current block.
     *
     * Returns previous value and new value.
     */
    function _stake(address _stakeholder, uint256 _value, uint64 _lockPeriod) 
        internal
        onlyActiveStaking
        returns(uint256)
    {
        //_burn(_msgSender(), _stake);
        require(_stakeholder!=address(0),"zero account");
        require(_value >= minStake, "less than minimum stake");
        require(_value<=balanceOf(_stakeholder), "not enough balance");
        require(rewardTable[_lockPeriod].rates.length > 0, "invalid period");
        require(punishmentTable[_lockPeriod].rates.length > 0, "invalid period");

        _transfer(_stakeholder, address(this), _value);
        //if(stakeholders[_msgSender()].totalStaked == 0) addStakeholder(_msgSender());
        
        uint256 pos = stakeholders[_stakeholder].stakes.length;
        uint256 old = stakeholders[_stakeholder].totalStaked;
        if (pos > 0 && stakeholders[_stakeholder].stakes[pos - 1].stakedAt == block.timestamp && 
            stakeholders[_stakeholder].stakes[pos - 1].lockPeriod == _lockPeriod) {
                stakeholders[_stakeholder].stakes[pos - 1].value = stakeholders[_stakeholder].stakes[pos - 1].value.add(_value);
        } else {
            uint256 _id = 1;
            if (pos > 0) _id = stakeholders[_stakeholder].stakes[pos - 1].id.add(1);
            stakeholders[_stakeholder].stakes.push(Stake({
                id: _id,
                stakedAt: block.timestamp,
                value: _value,
                lockPeriod: _lockPeriod
            }));
            pos++;
        }
        stakeholders[_stakeholder].totalStaked = stakeholders[_stakeholder].totalStaked.add(_value);
        // checkpoint total supply
        _updateTotalStaked(_value, true);

        emit Staked(_stakeholder,_value, stakeholders[_stakeholder].totalStaked, old);
        return(stakeholders[_stakeholder].stakes[pos-1].stakedAt);
    }

    /**
     * @dev Pushes a value onto a History so that it is stored as the checkpoint for the current block.
     *
     * Returns previous value and new value.
     */
    function _unstake(address _stakeholder, uint256 _stakedID, uint256 _value) 
        internal 
        onlyActiveStaking
    {
        //_burn(_msgSender(), _stake);
        require(_stakeholder!=address(0),"zero account");
        require(_value > 0, "zero unstake");
        require(_value <= stakeOf(_stakeholder) , "unstake more than staked");
        
        uint256 old = stakeholders[_stakeholder].totalStaked;
        require(stakeholders[_stakeholder].totalStaked>0,"not stake holder");
        uint256 stakeIndex;
        bool found = false;
        for (stakeIndex = 0; stakeIndex < stakeholders[_stakeholder].stakes.length; stakeIndex += 1){
            console.log("id -> ",stakeholders[_stakeholder].stakes[stakeIndex].id);
            if (stakeholders[_stakeholder].stakes[stakeIndex].id == _stakedID) {
                found = true;
                break;
            }
        }
        console.log("found: ",found);
        require(found,"stake not exist");
        require(_value<=stakeholders[_stakeholder].stakes[stakeIndex].value,"not enough stake");
        uint256 _stakedAt = stakeholders[_stakeholder].stakes[stakeIndex].stakedAt;
        require(block.timestamp>=_stakedAt,"invalid stake");
        console.log("unstake 2: OK");
        // make decision about reward/punishment
        uint256 stakingDays = (block.timestamp - _stakedAt) / (1 days);
        if (stakingDays>=stakeholders[_stakeholder].stakes[stakeIndex].lockPeriod) {
            //Reward
            uint256 _reward = _calculateReward(_stakedAt, block.timestamp, 
                stakeholders[_stakeholder].stakes[stakeIndex].value,
                stakeholders[_stakeholder].stakes[stakeIndex].lockPeriod);
            if (_reward>0) {
                _mint(_stakeholder,_reward);
            }
            _transfer(address(this), _stakeholder, _value);
        } else {
            //Punishment
            uint256 _punishment = _calculatePunishment(_stakedAt, block.timestamp, 
                stakeholders[_stakeholder].stakes[stakeIndex].value,
                stakeholders[_stakeholder].stakes[stakeIndex].lockPeriod);
            _punishment = _punishment<_value ? _punishment : _value;
            console.log("_punishment: ",_punishment);
            //If there is punishment, send them to tokenBank
            if (_punishment>0) {
                _transfer(address(this), tokenBank, _punishment); 
            }
            console.log("_punishment: transfered ");
            uint256 withdrawal = _value.sub( _punishment );
            console.log("withdrawal: ",withdrawal);
            if (withdrawal>0) {
                _transfer(address(this), _stakeholder, withdrawal);
            }
        }

        // deduct unstaked amount from locked ARDs
        stakeholders[_stakeholder].stakes[stakeIndex].value = stakeholders[_stakeholder].stakes[stakeIndex].value.sub(_value);
        if (stakeholders[_stakeholder].stakes[stakeIndex].value==0) {
            removeStakeRecord(_stakeholder, stakeIndex);
        }
        stakeholders[_stakeholder].totalStaked = stakeholders[_stakeholder].totalStaked.sub(_value);

        // checkpoint total supply
        _updateTotalStaked(_value, false);

        //if no any stakes, remove stake holder
        if (stakeholders[_stakeholder].totalStaked==0) {
           delete stakeholders[_stakeholder];
        }

        emit Unstaked(_stakeholder, _value, stakeholders[_stakeholder].totalStaked, old);
    }

    function removeStakeRecord(address _stakeholder, uint index) internal{
        for(uint i = index; i < stakeholders[_stakeholder].stakes.length-1; i++){
            stakeholders[_stakeholder].stakes[i] = stakeholders[_stakeholder].stakes[i+1];      
        }
        stakeholders[_stakeholder].stakes.pop();
    }

    function _updateTotalStaked(uint256 _by, bool _increase) internal onlyActiveStaking{
        uint256 currentStake = Checkpoints.latest(totalStakedHistory);

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            newStake = currentStake.sub(_by);
        }

        // add new value to total history
        Checkpoints.push(totalStakedHistory, newStake);
    }

    ///////////////////////////////////////////////////////////////////////
    // STAKEHOLDERS                                                      //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev A method to check if an address is a stakeholder.
     * @param _address The address to verify.
     * @return bool, uint256 Whether the address is a stakeholder, 
     * and if so its position in the stakeholders array.
     */
    function isStakeholder(address _address)
        public
        view
        returns(bool)
    {
        return (stakeholders[_address].totalStaked>0);
    }

    ///////////////////////////////////////////////////////////////////////
    // REWARDS / PUNISHMENTS                                             //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev A method for a stakeholder to create a stake.
     * @param _lockPeriod locking period (ex: 30,60,90,120,150, ...) in days
     * @param _value The reward per day for the given lock period
    */
    function setReward(uint256 _lockPeriod, uint64 _value)
        onlySupplyController
        public
    {
        require(_value>=0 && _value<=10000, "invalid rate");
        uint256 ratesCount = rewardTable[_lockPeriod].rates.length;
        uint256 oldRate = ratesCount>0 ? rewardTable[_lockPeriod].rates[ratesCount-1].rate : 0;
        rewardTable[_lockPeriod].rates.push(Rate({
            timestamp: block.timestamp,
            rate: _value
        }));
        emit RewardRateChanged(block.timestamp,_value,oldRate);
    }

    /**
     * @dev A method for a get the latest reward rate
     * @param _lockPeriod locking period (ex: 30,60,90,120,150, ...) in days
    */
    function rewardRate(uint256 _lockPeriod)
        view
        public
        returns(uint256)
    {
        uint256 ratesCount = rewardTable[_lockPeriod].rates.length;
        return (ratesCount>0 ? rewardTable[_lockPeriod].rates[ratesCount-1].rate : 0);
    }

    /**
     * @dev A method for a stakeholder to create a stake.
     * @param _lockPeriod locking period (ex: 30,60,90,120,150, ...) in days
     * @param _value The reward per day for the given lock period
    */
    function setPunishment(uint256 _lockPeriod, uint64 _value)
        onlySupplyController
        public
    {
        require(_value>=0 && _value<=10000, "invalid rate");
        uint256 ratesCount = punishmentTable[_lockPeriod].rates.length;
        uint256 oldRate = ratesCount>0 ? punishmentTable[_lockPeriod].rates[ratesCount-1].rate : 0;
        punishmentTable[_lockPeriod].rates.push(Rate({
            timestamp: block.timestamp,
            rate: _value
        }));
        emit PunishmentRateChanged(block.timestamp,_value,oldRate);
    }

    /**
     * @dev A method for a get the latest punishment rate
     * @param _lockPeriod locking period (ex: 30,60,90,120,150, ...) in days
    */
    function punishmentRate(uint256 _lockPeriod)
        view
        public
        returns(uint256)
    {
        uint256 ratesCount = punishmentTable[_lockPeriod].rates.length;
        return (ratesCount>0 ? punishmentTable[_lockPeriod].rates[ratesCount-1].rate : 0);
    }

    /**
     * @dev A method to the aggregated rewards from all stakeholders.
     * @return uint256 The aggregated rewards from all stakeholders.
     */
    function rewardOf(address _stakeholder)
        public
        view
        returns(uint256)
    {
        require(stakeholders[_stakeholder].totalStaked>0,"not stake holder");
        uint256 _totalRewards = 0;
        for (uint256 i = 0; i < stakeholders[_stakeholder].stakes.length; i++){
            Stake storage s = stakeholders[_stakeholder].stakes[i];
            uint256 r = _calculateReward(s.stakedAt, block.timestamp, s.value, s.lockPeriod);
            _totalRewards = _totalRewards.add(r);
        }
        return _totalRewards;
    }

    /** 
     * @dev A simple method that calculates the rewards for each stakeholder.
     * @param _stakeholder The stakeholder to calculate rewards for.
     */
    function calculateRewardFor(address _stakeholder, uint256 _stakedAt)
        public
        view
        returns(uint256)
    {
        require(stakeholders[_stakeholder].totalStaked>0,"not stake holder");
        uint256 stakeIndex;
        bool found = false;
        for (stakeIndex = 0; stakeIndex < stakeholders[_stakeholder].stakes.length; stakeIndex += 1){
            if (stakeholders[_stakeholder].stakes[stakeIndex].stakedAt == _stakedAt) {
                found = true;
                break;
            }
        }
        require(found,"stake not exist");
        Stake storage s = stakeholders[_stakeholder].stakes[stakeIndex];
        return _calculateReward(s.stakedAt, block.timestamp, s.value, s.lockPeriod);
    }

    /** 
     * @dev A simple method that calculates the rewards for each stakeholder.
     * @param _from The stakeholder to calculate rewards for.
     */
    function _calculateReward(uint256 _from, uint256 _to, uint256 _value, uint256 _lockPeriod)
        internal
        view
        returns(uint256)
    {
        require (_to>=_from,"invalid stake time");
        uint256 durationDays = _to.sub(_from).div(1 days);
        if (durationDays<_lockPeriod) return 0;


        return _calculateTotal(rewardTable[_lockPeriod],_from,_to,_value,_lockPeriod);
    }

    /** 
     * @dev A simple method that calculates the punishment for each stakeholder.
     * @param _from The stakeholder to calculate rewards for.
     */
    function _calculatePunishment(uint256 _from, uint256 _to, uint256 _value, uint256 _lockPeriod)
        internal
        view
        returns(uint256)
    {
        require (_to>=_from,"invalid stake time");
        uint256 durationDays = _to.sub(_from).div(1 days);
        if (durationDays>=_lockPeriod) return 0;

        return _calculateTotal(punishmentTable[_lockPeriod],_from,_to,_value,_lockPeriod);
    }

    function _calculateTotal(RateHistory storage _history, uint256 _from, uint256 _to, uint256 _value, uint256 _lockPeriod)
        internal
        view
        returns(uint256)
    {
        //find the first rate before _from 
        require(_history.rates.length>0,"invalid period");
        uint256 rIndex;
        for (rIndex = _history.rates.length-1; rIndex>0; rIndex-- ) {
            if (rIndex<_from) break;
        }
        // if rate hasn't been changed during the staking period, just calculate whole period using same rate
        if (rIndex==_history.rates.length-1) {
            return _value.mul(_history.rates[rIndex].rate).div(10000);  //10000 ~ 100.00
        }
        // otherwise we have to calculate reward per each rate change history
        uint256 total = 0;
        uint256 prevTimestamp = _from;
        uint256 t;
        for (rIndex++; rIndex<_history.rates.length && t<_to; rIndex++) {
            t = _history.rates[rIndex].timestamp;
            if (t>=_to) t=_to;
            // uint256 _days = t.sub(prevTimestamp).div(1 days);
            // uint256 r = _history.rates[i-1].rate;
            // profit for these duration = (_value * r * _days)/(_lockPeriod)
            total = total.add(_value.mul(_history.rates[rIndex-1].rate).mul(t.sub(prevTimestamp).div(1 days)).div(_lockPeriod));         
            prevTimestamp = t;
        }
        return total;
    }
}