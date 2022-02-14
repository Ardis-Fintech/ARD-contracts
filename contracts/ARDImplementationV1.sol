// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";

/**
 * @title ARDImplementationV1
 * @dev this contract is a Pausable ERC20 token with Burn and Mint
 * controlled by a central SupplyController. By implementing ARDImplementation
 * this contract also includes external methods for setting
 * a new implementation contract for the Proxy.
 * NOTE: The storage defined here will actually be held in the Proxy
 * contract and all calls to this contract should be made through
 * the proxy, including admin actions done as owner or supplyController.
 * Any call to transfer against this contract should fail
 * with insufficient funds since no tokens will be issued there.
 */
contract ARDImplementationV1 is ERC20Upgradeable, 
                                OwnableUpgradeable, 
                                AccessControlUpgradeable,
                                PausableUpgradeable, 
                                ReentrancyGuardUpgradeable {

    /*****************************************************************
    ** MATH                                                         **
    ******************************************************************/
    using SafeMath for uint256;

    /*****************************************************************
    ** ROLES                                                        **
    ******************************************************************/
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    bytes32 public constant ASSET_PROTECTION_ROLE = keccak256("ASSET_PROTECTION_ROLE");
    bytes32 public constant SUPPLY_CONTROLLER_ROLE = keccak256("SUPPLY_CONTROLLER_ROLE");

    /*****************************************************************
    ** MODIFIERS                                                    **
    ******************************************************************/
    modifier onlyAssetProtectionRole() {
        require(hasRole(ASSET_PROTECTION_ROLE, msg.sender), "only asset protection role");
        _;
    }

    modifier onlySupplyController() {
        require(hasRole(SUPPLY_CONTROLLER_ROLE, msg.sender), "only supply controller role");
        _;
    }

    modifier onlyMinterRole() {
        require(hasRole(MINTER_ROLE, msg.sender), "only minter role");
        _;
    }

    modifier onlyBurnerRole() {
        require(hasRole(BURNER_ROLE, msg.sender), "only burner role");
        _;
    }

    modifier notPaused() {
        require(!paused(), "is paused");
        _;
    }
    /*****************************************************************
    ** EVENTS                                                       **
    ******************************************************************/
    // ASSET PROTECTION EVENTS
    event AddressFrozen(address indexed addr);
    event AddressUnfrozen(address indexed addr);
    event FrozenAddressWiped(address indexed addr);
    event AssetProtectionRoleSet (
        address indexed oldAssetProtectionRole,
        address indexed newAssetProtectionRole
    );

    // SUPPLY CONTROL EVENTS
    event SupplyIncreased(address indexed to, uint256 value);
    event SupplyDecreased(address indexed from, uint256 value);
    event SupplyControllerSet(
        address indexed oldSupplyController,
        address indexed newSupplyController
    );

    /*****************************************************************
    ** DATA                                                         **
    ******************************************************************/

    uint8 private _decimals;

    // ASSET PROTECTION DATA
    mapping(address => bool) internal frozen;

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
     uint256 private _totalSupply;
    function initialize(string memory name_, string memory symbol_) public initializer{
        __Ownable_init();
        __ERC20_init(name_, symbol_);
        // Grant the contract deployer the default admin role: it will be able
        // to grant and revoke any roles
        _setupRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _decimals = 8;
        _totalSupply = 0;
        // assetProtectionRole = address(0);
        // supplyController = msg.sender;
    }

    /**
    The number of decimals
    */
    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

    ///////////////////////////////////////////////////////////////////////
    // BEFORE/AFTER TOKEN TRANSFER                                       //
    ///////////////////////////////////////////////////////////////////////

    /**
     * @dev Hook that is called before any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * will be transferred to `to`.
     * - when `from` is zero, `amount` tokens will be minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens will be burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override virtual {
        // check the addresses no to be frozen
        require(!paused(),"is paused");
        require(amount>0, "zero amount");
        require(!frozen[msg.sender], "caller is frozen");
        require(!frozen[from] || from==address(0), "address from is frozen");
        require(!frozen[to] || to==address(0), "address to is frozen");
        // check the roles in case of minting or burning
        // if (from == address(0)) {       // is minting
        //     require(hasRole(MINTER_ROLE,msg.sender) || hasRole(SUPPLY_CONTROLLER_ROLE,msg.sender), "Caller is not a minter");
        // } else if (to == address(0)) {  // is burning
        //     require(hasRole(BURNER_ROLE,msg.sender) || hasRole(SUPPLY_CONTROLLER_ROLE,msg.sender), "Caller is not a burner");
        // }
    }

    /**
     * @dev Hook that is called after any transfer of tokens. This includes
     * minting and burning.
     *
     * Calling conditions:
     *
     * - when `from` and `to` are both non-zero, `amount` of ``from``'s tokens
     * has been transferred to `to`.
     * - when `from` is zero, `amount` tokens have been minted for `to`.
     * - when `to` is zero, `amount` of ``from``'s tokens have been burned.
     * - `from` and `to` are never both zero.
     *
     * To learn more about hooks, head to xref:ROOT:extending-contracts.adoc#using-hooks[Using Hooks].
     */
    function _afterTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override virtual {

        require(amount>0,"zero amount");
        if (from == address(0)) {       // is minted
            emit SupplyIncreased( to, amount);
        } else if (to == address(0)) {  // is burned
            emit SupplyDecreased( from, amount);
        }
        
    }

    ///////////////////////////////////////////////////////////////////////
    // APPROVE                                                           //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev See {IERC20-approve}.
     *
     * Requirements:
     *
     * - `spender` cannot be the zero address.
     */
    function approve(address spender, uint256 amount) public override returns (bool) {
        require(!paused(),"is paused");
        require(!frozen[msg.sender], "caller is frozen");
        require(!frozen[spender], "address spender is frozen");
        _approve(_msgSender(), spender, amount);
        return true;
    }

    ///////////////////////////////////////////////////////////////////////
    // PAUSE / UNPAUSE                                                   //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev Triggers stopped state.
     *
     * Requirements:
     *
     * - The contract must not be paused.
     */
    function pause() public onlyOwner {
        _pause();
    }

    /**
     * @dev Returns to normal state.
     *
     * Requirements:
     *
     * - The contract must be paused.
     */
    function unpause() public onlyOwner {
        _unpause();
    }

    ///////////////////////////////////////////////////////////////////////
    // ROLE MANAGEMENT                                                   //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev Grants `role` to `account`.
     *
     * If `account` had not been already granted `role`, emits a {RoleGranted}
     * event.
     *
     * Requirements:
     *
     * - the caller must have ``role``'s admin role.
     */
    function grantRole(bytes32 role, address account) public override notPaused onlyRole(getRoleAdmin(role)) {
        _grantRole(role, account);
    }

    /**
     * @dev Revokes `role` from `account`.
     *
     * Internal function without access restriction.
     */
    function revokeRole(bytes32 role, address account) public override notPaused onlyRole(getRoleAdmin(role)) {
        _revokeRole(role, account);
    }

    /**
     * @dev set/revoke the Minter role to specific account
     * @param _addr The address to assign minter role.
     */
    function setMinterRole(address _addr) public notPaused onlyRole(getRoleAdmin(MINTER_ROLE)) {
        grantRole(MINTER_ROLE, _addr);
    }
    function revokeMinterRole(address _addr) public notPaused onlyRole(getRoleAdmin(MINTER_ROLE)) {
        revokeRole(MINTER_ROLE, _addr);
    }
    function isMinter(address _addr) public view returns (bool) {
        return hasRole(MINTER_ROLE, _addr);
    }

    /**
     * @dev set/revoke the Burner role to specific account
     * @param _addr The address to assign burner role.
     */
    function setBurnerRole(address _addr) public notPaused onlyRole(getRoleAdmin(BURNER_ROLE)) {
        grantRole(BURNER_ROLE, _addr);
    }
    function revokeBurnerRole(address _addr) public notPaused onlyRole(getRoleAdmin(BURNER_ROLE)) {
        revokeRole(BURNER_ROLE, _addr);
    }
    function isBurner(address _addr) public view returns (bool) {
        return hasRole(BURNER_ROLE, _addr);
    }

    /**
     * @dev set/revoke the Asset Protection role to specific account
     * @param _addr The address to assign asset protection role.
     */
    function setAssetProtectionRole(address _addr) public notPaused onlyRole(getRoleAdmin(ASSET_PROTECTION_ROLE)) {
        grantRole(ASSET_PROTECTION_ROLE, _addr);
    }
    function revokeAssetProtectionRole(address _addr) public notPaused onlyRole(getRoleAdmin(ASSET_PROTECTION_ROLE)) {
        revokeRole(ASSET_PROTECTION_ROLE, _addr);
    }
    function isAssetProtection(address _addr) public view returns (bool) {
        return hasRole(ASSET_PROTECTION_ROLE, _addr);
    }

    /**
     * @dev set/revoke the Supply Controller role to specific account
     * @param _addr The address to assign supply controller role.
     */
    function setSupplyControllerRole(address _addr) public notPaused onlyRole(getRoleAdmin(SUPPLY_CONTROLLER_ROLE)) {
        grantRole(SUPPLY_CONTROLLER_ROLE, _addr);
    }
    function revokeSupplyControllerRole(address _addr) public notPaused onlyRole(getRoleAdmin(SUPPLY_CONTROLLER_ROLE)) {
        revokeRole(SUPPLY_CONTROLLER_ROLE, _addr);
    }
    function isSupplyController(address _addr) public view returns (bool) {
        return hasRole(SUPPLY_CONTROLLER_ROLE, _addr);
    }

    ///////////////////////////////////////////////////////////////////////
    // ASSET PROTECTION FUNCTIONALITY                                    //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev Freezes an address balance from being transferred.
     * @param _addr The new address to freeze.
     */
    function freeze(address _addr) public onlyAssetProtectionRole {
        require(!frozen[_addr], "address already frozen");
        //TODO: shouldn't be able to freeze admin,minter,burner,asset protection,supply controller roles
        frozen[_addr] = true;
        emit AddressFrozen(_addr);
    }

    /**
     * @dev Unfreezes an address balance allowing transfer.
     * @param _addr The new address to unfreeze.
     */
    function unfreeze(address _addr) public onlyAssetProtectionRole {
        require(frozen[_addr], "address already unfrozen");
        frozen[_addr] = false;
        emit AddressUnfrozen(_addr);
    }

    /**
     * @dev Wipes the balance of a frozen address, burning the tokens
     * and setting the approval to zero.
     * @param _addr The new frozen address to wipe.
     */
    function wipeFrozenAddress(address _addr) public onlyAssetProtectionRole {
        require(frozen[_addr], "address is not frozen");
        uint256 _balance = balanceOf(_addr);
        frozen[_addr] = false;
        _burn(_addr,_balance);
        frozen[_addr] = true;
        emit FrozenAddressWiped(_addr);
    }

    /**
    * @dev Gets whether the address is currently frozen.
    * @param _addr The address to check if frozen.
    * @return A bool representing whether the given address is frozen.
    */
    function isFrozen(address _addr) public view returns (bool) {
        return frozen[_addr];
    }


    ///////////////////////////////////////////////////////////////////////
    // MINTING / BURNING                                                 //
    ///////////////////////////////////////////////////////////////////////

    /** @dev Creates `amount` tokens and assigns them to `account`, increasing
     * the total supply.
     *
     * Emits a {Transfer} event with `from` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     */
    function mint(address account, uint256 amount) public onlyMinterRole {
        _mint(account, amount);
    }

    /**
     * @dev Destroys `amount` tokens from `account`, reducing the
     * total supply.
     *
     * Emits a {Transfer} event with `to` set to the zero address.
     *
     * Requirements:
     *
     * - `account` cannot be the zero address.
     * - `account` must have at least `amount` tokens.
     */
    function burn(address account, uint256 amount) public onlyMinterRole {
        _burn(account, amount);
    }

    ///////////////////////////////////////////////////////////////////////
    // SUPPLY CONTROL                                                    //
    ///////////////////////////////////////////////////////////////////////
    /**
     * @dev Increases the total supply by minting the specified number of tokens to the supply controller account.
     * @param _value The number of tokens to add.
     * @return A boolean that indicates if the operation was successful.
     */
    function increaseSupply(uint256 _value) public onlySupplyController returns (bool) {
        _mint(msg.sender, _value);
        return true;
    }

    /**
     * @dev Decreases the total supply by burning the specified number of tokens from the supply controller account.
     * @param _value The number of tokens to remove.
     * @return A boolean that indicates if the operation was successful.
     */
    function decreaseSupply(uint256 _value) public onlySupplyController returns (bool) {
        require(_value <= balanceOf(msg.sender), "not enough supply");
        _burn(msg.sender, _value);
        return true;
    }
}
