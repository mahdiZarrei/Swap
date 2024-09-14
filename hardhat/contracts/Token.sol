// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title SimpleToken Contract
/// @notice This contract represents a default ERC20 token.
contract SimpleToken is ERC20 {
    constructor(
        string memory _name,
        string memory _symbol
    ) payable ERC20(_name, _symbol) {
        _mint(msg.sender, 100000000 * 10 ** decimals());
    }
}
