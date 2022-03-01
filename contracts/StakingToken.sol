// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

//import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "contracts/ARDImplementationV1.sol";
import "@openzeppelin/contracts/utils/Checkpoints.sol";

import "hardhat/console.sol";

/**
 * @title Staking Token (STK)
 * @author Alberto Cuesta Canada
 * @notice Implements a basic ERC20 staking token with incentive distribution.
 */
contract StakingToken is ARDImplementationV1 {
    using SafeMath for uint256;

    struct Stake {
        uint256 value;
        uint256 stakedAt; 
        uint64  lockPeriod;
    }

    struct StakeHolder {
        //mapping (address => Lock) locks; // Mapping of lock manager => lock info
        uint256 totalStaked;
        //uint256 totalReward;
        Stake[] stakes;
        //Checkpointing.History stakedHistory;
    }

    
    Checkpoints.History internal totalStakedHistory;
    
    /**
     * @dev start/stop staking
     */
    bool stakingEnabled;

    /**
     * @dev We usually require to know who are all the stakeholders.
     */
    mapping(address => StakeHolder) internal stakeholders;

    /**
     * @dev The stakes for each stakeholder.
     */
    // mapping(address => uint256) internal stakes;

    /**
     * @dev The reward per day for each period of locking assets.
     */
    mapping(uint256 => uint256) internal rewardTable;
    mapping(uint256 => uint256) internal punishmentTable;

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
     * @dev sets 0 initials tokens, the owner, and the supplyController.
     * this serves as the constructor for the proxy but compiles to the
     * memory model of the Implementation contract.
     */
    function initialize(string memory name_, string memory symbol_) public initializer{
        _initialize(name_, symbol_);
        
        // init reward table
        rewardTable[30]  = 100;  // 1.00%
        rewardTable[60]  = 200;  // 2.00%
        rewardTable[90]  = 200;  // 3.00%
        rewardTable[150] = 200;  // 5.00%
        rewardTable[180] = 200;  // 6.00%
        rewardTable[360] = 200;  // 12.00%

        // init punishment table
        punishmentTable[30]  = 100;  // 1.00%
        punishmentTable[60]  = 200;  // 2.00%
        punishmentTable[90]  = 200;  // 3.00%
        punishmentTable[150] = 200;  // 5.00%
        punishmentTable[180] = 200;  // 6.00%
        punishmentTable[360] = 200;  // 12.00%

        //enable staking by default
        setEnabled(true);
    }


    ///////////////////////////////////////////////////////////////////////
    // STAKING                                                           //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @notice enable/disable stoking
     * @param _enabled enable/disable
    */
    function setEnabled(bool _enabled)
        onlySupplyController
        public
    {
        stakingEnabled=_enabled;
    }

    /**
     * @notice A method for a stakeholder to create a stake.
     * @param _lockPeriod locking period (ex: 30,60,90,120,150, ...) in days
     * @param _value The reward per day for the given lock period
    */
    function setReward(uint256 _lockPeriod, uint64 _value)
        onlySupplyController
        public
    {
        rewardTable[_lockPeriod] = _value;
    }

    /**
     * @notice A method for a stakeholder to create a stake.
     * @param _lockPeriod locking period (ex: 30,60,90,120,150, ...) in days
     * @param _value The reward per day for the given lock period
    */
    function setPunishment(uint256 _lockPeriod, uint64 _value)
        onlySupplyController
        public
    {
        punishmentTable[_lockPeriod] = _value;
    }

    /**
     * @notice A method for a stakeholder to create a stake.
     * @param _value The size of the stake to be created.
    */
    function stake(uint256 _value, uint64 _lockPeriod)
        public
        returns(uint256)
    {
        return _stake(_msgSender(), _value, _lockPeriod);
    }
    /**
     * @notice A method to create a stake in behalf of stakeholder.
     * @param _value The size of the stake to be created.
     */
    function stakeFor(address _stakeholder, uint256 _value, uint64 _lockPeriod)
        public
        onlySupplyController
        returns(uint256)
    {
        return _stake(_stakeholder, _value, _lockPeriod);
    }

    /**
     * @notice A method for a stakeholder to remove a stake.
     * @param _value The size of the stake to be removed.
     */
    function unstake(uint256 _stakedAt, uint256 _value)
        public
    {
        _unstake(_msgSender(),_stakedAt,_value);
    }

    /**
     * @notice A method for a stakeholder to remove a stake.
     * @param _value The size of the stake to be removed.
     */
    function unstakeFor(address _stakeholder, uint256 _stakedAt, uint256 _value)
        public
        onlySupplyController
    {
        _unstake(_stakeholder,_stakedAt,_value);
    }

    /**
     * @notice A method to retrieve the stake for a stakeholder.
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
     * @notice A method to retrieve the stakes for a stakeholder.
     * @param _stakeholder The stakeholder to retrieve the stake for.
     * @return staking history.
     */
    function stakes(address _stakeholder)
        public
        view
        returns(Stake[] memory)
    {
        return(stakeholders[_stakeholder].stakes);
    }

    /**
     * @notice A method to the aggregated stakes from all stakeholders.
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
        require(_value > 0, "zero stake");
        require(_value<=balanceOf(_stakeholder), "not enough balance");
        require(rewardTable[_lockPeriod] > 0, "invalid period");

        _transfer(_stakeholder, address(this), _value);
        //if(stakeholders[_msgSender()].totalStaked == 0) addStakeholder(_msgSender());
        
        uint256 pos = stakeholders[_stakeholder].stakes.length;
        uint256 old = stakeholders[_stakeholder].totalStaked;
        if (pos > 0 && stakeholders[_stakeholder].stakes[pos - 1].stakedAt == block.timestamp && 
            stakeholders[_stakeholder].stakes[pos - 1].lockPeriod == _lockPeriod) {
                stakeholders[_stakeholder].stakes[pos - 1].value = stakeholders[_stakeholder].stakes[pos - 1].value.add(_value);
        } else {
            stakeholders[_stakeholder].stakes.push(Stake(_value, block.timestamp, _lockPeriod));
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
    function _unstake(address _stakeholder, uint256 _stakedAt, uint256 _value) 
        internal 
        onlyActiveStaking
    {
        //_burn(_msgSender(), _stake);
        require(_stakeholder!=address(0),"zero account");
        require(_value > 0, "zero unstake");
        require(_value <= stakeOf(_stakeholder) , "unstake more than staked");
        
        _transfer(address(this), _stakeholder, _value);
        //if(stakeholders[_msgSender()].totalStaked == 0) addStakeholder(_msgSender());

        uint256 old = stakeholders[_stakeholder].totalStaked;
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
        require(_value<=stakeholders[_stakeholder].stakes[stakeIndex].value,"stake not exist");
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

    // function _updateStakeBalance(address _user, uint256 _by, bool _increase) internal returns (uint256) {
    //     uint256 currentStake = _totalStakedFor(_user);

    //     uint256 newStake;
    //     if (_increase) {
    //         newStake = currentStake.add(_by);
    //     } else {
    //         require(_by <= balanceOf(_user), "not enough balance");
    //         newStake = currentStake.sub(_by);
    //     }
    //     // add new value to account history
    //     Checkpoints.push(stakeholders[_user].stakes, newStake);
    //     // stakeholders[_user].stakedHistory.add(getBlockNumber64(), newStake);

    //     return newStake;
    // }

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
     * @notice A method to check if an address is a stakeholder.
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

    // /**
    //  * @dev A method to add a stakeholder.
    //  * @param _address The stakeholder to add.
    //  */
    // function addStakeholder(address _address)
    //     public
    // {
    //     bool _isStakeholder = isStakeholder(_address);
    //     require(!_isStakeholder,"already exist");
    //     StakeHolder storage sh;
    //     stakeholders[_address] = sh;
    //     // Checkpoints.Checkpoint[] memory cp;
    //     // stakeholders[_address]=StakeHolder({
    //     //     totalStaked: 0,
    //     //     stakes: Checkpoints.History({
    //     //         _checkpoints: cp
    //     //     })
    //     // });
    // }

    // /**
    //  * @notice A method to remove a stakeholder.
    //  * @param _address The stakeholder to remove.
    //  */
    // function removeStakeholder(address _address)
    //     public
    // {
    //     require(isStakeholder(_address),"should be stake holder");
    //     delete stakeholders[_address];
    // }

    ///////////////////////////////////////////////////////////////////////
    // REWARDS                                                           //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @notice A method to the aggregated rewards from all stakeholders.
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
            uint256 r = _calculateReward(s.stakedAt, block.timestamp, s.value, rewardTable[s.lockPeriod]);
            _totalRewards = _totalRewards.add(r);
        }
        return _totalRewards;
    }

    /** 
     * @notice A simple method that calculates the rewards for each stakeholder.
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
        return _calculateReward(s.stakedAt, block.timestamp, s.value, rewardTable[s.lockPeriod]);
    }

    /** 
     * @notice A simple method that calculates the rewards for each stakeholder.
     * @param _from The stakeholder to calculate rewards for.
     */
    function _calculateReward(uint256 _from, uint256 _to, uint256 _value, uint256 _rewardPerShare)
        internal
        pure
        returns(uint256)
    {
        if (_to<=_from) return 0;
        uint256 duration = _to.sub(_from);
        uint256 durationDays = duration.div(1 days);
        return durationDays.mul(_value).mul(_rewardPerShare);
    }

    /** 
     * @notice A simple method that calculates the punishment for each stakeholder.
     * @param _from The stakeholder to calculate rewards for.
     */
    function _calculatePunishment(uint256 _from, uint256 _to, uint256 _value, uint256 _punishmentPerShare)
        internal
        pure
        returns(uint256)
    {
        if (_to<=_from) return 0;
        uint256 duration = _to.sub(_from);
        uint256 durationDays = duration.div(1 days);
        return durationDays.mul(_value).mul(_punishmentPerShare);
    }

    // /**
    //  * @notice A method to distribute rewards to all stakeholders.
    //  */
    // function distributeRewards() 
    //     public
    //     onlyOwner
    // {
    //     for (uint256 s = 0; s < stakeholders.length; s += 1){
    //         address stakeholder = stakeholders[s];
    //         uint256 reward = calculateReward(stakeholder);
    //         rewards[stakeholder] = rewards[stakeholder].add(reward);
    //     }
    // }

    // /**
    //  * @notice A method to allow a stakeholder to withdraw his rewards.
    //  */
    // function withdrawReward() 
    //     public
    // {
    //     uint256 reward = rewards[_msgSender()];
    //     rewards[_msgSender()] = 0;
    //     _mint(_msgSender(), reward);
    // }
}