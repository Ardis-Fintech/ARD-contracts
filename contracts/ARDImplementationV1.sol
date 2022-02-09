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
        require(amount>0, "zero amount");
        require(!frozen[msg.sender], "caller is frozen");
        require(!frozen[from] || from==address(0), "address from is frozen");
        require(!frozen[to] || to==address(0), "address to is frozen");
        // check the roles in case of minting or burning
        if (from == address(0)) {       // is minting
            require(hasRole(MINTER_ROLE, msg.sender), "Caller is not a minter");
        } else if (to == address(0)) {  // is burning
            require(hasRole(BURNER_ROLE, msg.sender), "Caller is not a burner");
        }
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

        if (from == address(0)) {       // is minting
            emit SupplyIncreased( to, amount);
        } else if (to == address(0)) {  // is burning
            emit SupplyDecreased( from, amount);
        }
        
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

}
