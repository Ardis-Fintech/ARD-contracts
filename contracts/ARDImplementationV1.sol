// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/PausableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";

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
contract ARDImplementationV1 is ERC20Upgradeable, OwnableUpgradeable, PausableUpgradeable, ReentrancyGuardUpgradeable {

    /*****************************************************************
    ** MATH                                                         **
    ******************************************************************/
    using SafeMath for uint256;

    /*****************************************************************
    ** DATA                                                         **
    ******************************************************************/

    uint8 private _decimals;

    // ASSET PROTECTION DATA
    address public assetProtectionRole;
    mapping(address => bool) internal frozen;

    // SUPPLY CONTROL DATA
    address public supplyController;

    /*****************************************************************
    ** FUNCTIONALITY                                                **
    ******************************************************************/
    // This constructor serves the purpose of leaving the implementation contract in an initialized state, 
    // which is a mitigation against certain potential attacks.
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() initializer {

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
        _decimals = 8;
        _totalSupply = 0;
        assetProtectionRole = address(0);
        supplyController = msg.sender;
    }

    function decimals() public view virtual override returns (uint8) {
        return _decimals;
    }

}
