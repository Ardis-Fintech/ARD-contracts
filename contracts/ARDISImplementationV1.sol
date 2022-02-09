// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

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
contract ARDImplementationV1 is Initializable {

    /*****************************************************************
    ** MATH                                                         **
    ******************************************************************/
    using SafeMath for uint256;

    /*****************************************************************
    ** DATA                                                         **
    ******************************************************************/
    uint256 internal totalSupply_;
    string public constant name = "ARDIS Token"; // solium-disable-line
    string public constant symbol = "ARD"; // solium-disable-line uppercase
    uint8 public constant decimals = 18; // solium-disable-line uppercase

    // OWNER DATA PART 1
    address public owner;

    // PAUSABILITY DATA
    bool public paused;

    // ASSET PROTECTION DATA
    address public assetProtectionRole;
    // mapping(address => bool) internal frozen;

    // SUPPLY CONTROL DATA
    address public supplyController;

    /*****************************************************************
    ** FUNCTIONALITY                                                **
    ******************************************************************/
    /**
     * @dev sets 0 initials tokens, the owner, and the supplyController.
     * this serves as the constructor for the proxy but compiles to the
     * memory model of the Implementation contract.
     */
    function initialize() public initializer{
        owner = msg.sender;
        assetProtectionRole = address(0);
        totalSupply_ = 0;
        supplyController = msg.sender;
    }

}
