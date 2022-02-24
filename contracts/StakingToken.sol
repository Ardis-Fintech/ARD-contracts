// SPDX-License-Identifier: MIT
pragma solidity ^0.8.2;
pragma experimental ABIEncoderV2;

//import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "contracts/ARDImplementationV1.sol";
import "@openzeppelin/contracts/utils/Checkpoints.sol";

/**
 * @title Staking Token (STK)
 * @author Alberto Cuesta Canada
 * @notice Implements a basic ERC20 staking token with incentive distribution.
 */
contract StakingToken is ARDImplementationV1 {
    using SafeMath for uint256;


    struct Stake {
        uint256 amount;
        uint256 stakedAt; 
    }

    struct StakeHolder {
        //mapping (address => Lock) locks; // Mapping of lock manager => lock info
        uint256 totalStaked;
        //uint256 totalReward;
        Checkpoints.History stakes;
        //Checkpointing.History stakedHistory;
    }

    
    Checkpoints.History internal totalStakedHistory;
    
    /**
     * @dev We usually require to know who are all the stakeholders.
     */
    mapping(address => StakeHolder) internal stakeholders;

    /**
     * @dev The stakes for each stakeholder.
     */
    // mapping(address => uint256) internal stakes;

    /**
     * @dev The accumulated rewards for each stakeholder.
     */
    // mapping(address => uint256) internal rewards;

    /*****************************************************************
    ** EVENTS                                                       **
    ******************************************************************/
    event Staked(address indexed from, uint256 amount, uint256 newStake);
    event Unstaked(address indexed from, uint256 amount, uint256 newStake);

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
    //uint256 private _totalSupply;
    function initialize(string memory name_, string memory symbol_) public initializer{
        _initialize(name_, symbol_);
    }


    ///////////////////////////////////////////////////////////////////////
    // STAKING                                                           //
    ///////////////////////////////////////////////////////////////////////

    /**
     * @notice A method for a stakeholder to create a stake.
     * @param _stake The size of the stake to be created.
     */
    function stake(uint256 _stake)
        public
    {
        //_burn(_msgSender(), _stake);
        require(_stake > 0, "zero stake");
        _transfer(_msgSender(), address(this), _stake);
        //if(stakeholders[_msgSender()].totalStaked == 0) addStakeholder(_msgSender());

        // checkpoint updated staking balance
        uint256 newStake = _updateStakeBalance(_msgSender(), _stake, true);

        // checkpoint total supply
        _updateTotalStaked(_stake, true);

        // Checkpoints.push(stakeholders[_msgSender()].stakes,_stake);
        // stakeholders[_msgSender()].totalStaked.add(_stake);

        emit Staked(_msgSender(),_stake, newStake);
    }

    /**
     * @notice A method for a stakeholder to remove a stake.
     * @param _stake The size of the stake to be removed.
     */
    function unstake(uint256 _stake)
        public
    {
        //_burn(_msgSender(), _stake);
        require(_stake > 0, "zero unstake");
        require(_stake < _totalStakedFor(_msgSender()) , "unstake more than staked");
        _transfer(address(this), _msgSender(), _stake);
        //if(stakeholders[_msgSender()].totalStaked == 0) addStakeholder(_msgSender());

        // checkpoint updated staking balance
        uint256 newStake = _updateStakeBalance(_msgSender(), _stake, false);

        // checkpoint total supply
        _updateTotalStaked(_stake, false);

        // Checkpoints.push(stakeholders[_msgSender()].stakes,_stake);
        // stakeholders[_msgSender()].totalStaked.add(_stake);

        emit Unstaked(_msgSender(), _stake, newStake);


        // stakes[_msgSender()] = stakes[_msgSender()].sub(_stake);
        // if(stakes[_msgSender()] == 0) removeStakeholder(_msgSender());
        // _mint(_msgSender(), _stake);
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
        return _totalStakedFor(_stakeholder);
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
        return _totalStaked();
    }


    function _totalStakedFor(address _user) internal view returns (uint256) {
        // we assume it's not possible to stake in the future
        return Checkpoints.latest(stakeholders[_user].stakes);
    }

    function _totalStaked() internal view returns (uint256) {
        // we assume it's not possible to stake in the future
        return Checkpoints.latest(totalStakedHistory);
    }

    function _updateStakeBalance(address _user, uint256 _by, bool _increase) internal returns (uint256) {
        uint256 currentStake = _totalStakedFor(_user);

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            require(_by <= balanceOf(_user), "not enough balance");
            newStake = currentStake.sub(_by);
        }
        // add new value to account history
        Checkpoints.push(stakeholders[_user].stakes, newStake);
        // stakeholders[_user].stakedHistory.add(getBlockNumber64(), newStake);

        return newStake;
    }

    function _updateTotalStaked(uint256 _by, bool _increase) internal {
        uint256 currentStake = _totalStaked();

        uint256 newStake;
        if (_increase) {
            newStake = currentStake.add(_by);
        } else {
            newStake = currentStake.sub(_by);
        }

        // add new value to total history
        Checkpoints.push(totalStakedHistory, newStake);
        // totalStakedHistory.add(getBlockNumber64(), newStake);
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
        // for (uint256 s = 0; s < stakeholders.length; s += 1){
        //     if (_address == stakeholders[s]) return (true, s);
        // }
        return (stakeholders[_address].stakes._checkpoints.length>0);
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

    /**
     * @notice A method to remove a stakeholder.
     * @param _address The stakeholder to remove.
     */
    function removeStakeholder(address _address)
        public
    {
        require(isStakeholder(_address),"should be stake holder");
        delete stakeholders[_address];
    }

    ///////////////////////////////////////////////////////////////////////
    // REWARDS                                                           //
    ///////////////////////////////////////////////////////////////////////
    // /**
    //  * @notice A method to allow a stakeholder to check his rewards.
    //  * @param _stakeholder The stakeholder to check rewards for.
    //  */
    // function rewardOf(address _stakeholder) 
    //     public
    //     view
    //     returns(uint256)
    // {
    //     return rewards[_stakeholder];
    // }

    // /**
    //  * @notice A method to the aggregated rewards from all stakeholders.
    //  * @return uint256 The aggregated rewards from all stakeholders.
    //  */
    // function totalRewards()
    //     public
    //     view
    //     returns(uint256)
    // {
    //     uint256 _totalRewards = 0;
    //     for (uint256 s = 0; s < stakeholders.length; s += 1){
    //         _totalRewards = _totalRewards.add(rewards[stakeholders[s]]);
    //     }
    //     return _totalRewards;
    // }

    // /** 
    //  * @notice A simple method that calculates the rewards for each stakeholder.
    //  * @param _stakeholder The stakeholder to calculate rewards for.
    //  */
    // function calculateReward(address _stakeholder)
    //     public
    //     view
    //     returns(uint256)
    // {
    //     return stakes[_stakeholder] / 100;
    // }

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