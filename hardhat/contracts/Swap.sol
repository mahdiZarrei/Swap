// SPDX-License-Identifier: MIT

pragma solidity 0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {SimpleToken} from "./Token.sol";

/**
 * @title Swap Contract
 * @dev A simple DEX-like contract that allows creation and swapping of tokens for Ether or other tokens.
 *      This contract allows the owner to deploy up to three ERC20 tokens and provides functionalities
 *      for swapping Ether to tokens, tokens to Ether, and token to token swapping.
 */

contract Swap {
    /// @notice Owner of the contract

    address public owner;
    /**
     * @dev Prevents a contract from calling itself, directly or indirectly.
     */
    bool internal locked;
    address public immutable self = address(this);

    /// @notice The Ether value used in swap calculations (1 Ether = 100,000 Gwei)

    uint56 private immutable eth_Value = 1e14;

    /// @notice The number of tokens deployed by the contract

    uint8 public count_Tokens;

    /// @dev Emitted when a new token is deployed
    /// @param owner The address of the contract owner who deployed the token
    /// @param token The address of the newly created token contract

    event TokenDeployed(address indexed owner, address token);

    /// @notice Emitted when ETH is swapped to Token.
    /// @param amountEth The amount of ETH swapped.
    /// @param amountToken The amount of Tokens received.

    event SwapEthToToken(
        uint256 indexed amountEth,
        uint256 indexed amountToken
    );

    /// @notice Emitted when Token is swapped to ETH.
    /// @param amountToken The amount of Tokens received.
    /// @param amountEth The amount of ETH swapped.

    event SwapTokenToEth(
        uint256 indexed amountToken,
        uint256 indexed amountEth
    );

    /// @notice Emitted when Token is swapped to another Token.
    /// @param amountToken The amount of Token swapped.

    event SwapTokenToToken(uint256 indexed amountToken);
    /// @notice Emitted when the owner withdraws Ether from the contract.
    /// @param recipient The address that received the Ether.
    /// @param amount The amount of Ether that was withdrawn.
    event Withdrawal(address indexed recipient, uint256 amount);

    /// @dev Error indicating that the maximum number of tokens has been deployed
    /// @param tokenNumber The current number of tokens

    error Token(uint8 tokenNumber);

    /// @dev Error indicating that the caller is not the contract owner
    /// @param owner The address of the caller

    error OwnerErr(address owner);

    /// @notice Mapping of token index to the deployed ERC20 token instances
    mapping(uint8 => ERC20) public tokensMap;

    /**
     * @dev Modifier to prevent re-entrancy attacks.
     */
    modifier nonReentrant() {
        require(!locked, "No re-entrancy");
        locked = true;
        _;
        locked = false;
    }
    /// @dev Modifier to limit the number of tokens that can be deployed (maximum of 3)
    modifier countToken() {
        if (count_Tokens >= 3) {
            revert Token(count_Tokens);
        }

        _;
    }

    /// @dev Modifier to ensure that the token index is valid
    /// @param token The index of the token

    modifier NotToken(uint8 token) {
        if (token >= count_Tokens) {
            revert Token(token);
        }

        _;
    }

    /// @dev Modifier to ensure that at least one token has been deployed

    modifier nullToken() {
        if (count_Tokens == 0) {
            revert Token(count_Tokens);
        }

        _;
    }

    modifier validAmount(uint256 _amount) {
        require(_amount > 0, "Amount must be greater than zero");

        _;
    }

    /// @dev Modifier to restrict function access to the contract owner only

    modifier onlyOwner() {
        if (msg.sender != owner) {
            revert OwnerErr(msg.sender);
        }

        _;
    }

    /**
     * @notice Constructor that sets the contract deployer as the owner
     * @dev The constructor is payable to allow the contract to receive Ether during deployment
     */
    constructor() payable {
        owner = msg.sender;
    }
    /**
     * @notice Fallback function to accept Ether deposits.
     * @dev This function is called when Ether is sent directly to the contract's address.
     */
    receive() external payable {}
    /**
     * @notice Creates a new ERC20 token
     * @dev Only the owner can create tokens, and a maximum of 3 tokens can be created
     * @param tokenName The name of the new token
     * @param tokenSymbol The symbol of the new token
     * @param _salt The salt value used for deterministic deployment
     * @custom:emit TokenDeployed Emitted when a new token is deployed
     */

    function createToken(
        string memory tokenName,
        string memory tokenSymbol,
        bytes32 _salt
    ) public countToken onlyOwner {
        uint8 tokenCount = count_Tokens;

        SimpleToken token = (new SimpleToken){salt: _salt}(
            tokenName,
            tokenSymbol
        );

        tokensMap[tokenCount] = token;

        emit TokenDeployed(self, address(token));

        count_Tokens = tokenCount + 1;
    }

    /**
     * @notice Swaps Ether for a specified token
     * @param token The index of the token
     * @dev The caller must send Ether along with the transaction
     */

    function swapEthToToken(
        uint8 token
    ) public payable nullToken NotToken(token) nonReentrant {
        uint256 outputValue = (msg.value / eth_Value) * 10 ** 18;

        if (outputValue != 0) {
            require(
                getBalance(token, self) > outputValue - 1,
                "Insufficient tokens"
            );

            bool success = tokensMap[token].transfer(msg.sender, outputValue);

            require(success, "Transfer failed");

            emit SwapEthToToken(msg.value, outputValue);
        }
    }

    /**
     * @notice Swaps a specified token for Ether
     * @param token The index of the token
     * @param _amount The amount of tokens to swap for Ether
     * @dev The caller must approve the contract to transfer the specified amount of tokens
     */

    function swapTokenToEth(
        uint8 token,
        uint256 _amount
    ) public nullToken NotToken(token) validAmount(_amount) nonReentrant {
        uint256 balance = getBalance(token, msg.sender);
        require(_amount < balance + 1, "Not enough tokens");

        uint256 exactAmount = _amount / 10 ** 18;
        uint256 ethToBeTransferred = exactAmount * eth_Value;

        uint256 availableEthBalance = self.balance;
        require(
            availableEthBalance + 1 > ethToBeTransferred,
            "Dex is running low on balance"
        );

        bool tokenTransferSuccess = tokensMap[token].transferFrom(
            msg.sender,
            self,
            _amount
        );
        require(tokenTransferSuccess, "Token transfer failed");

        payable(msg.sender).transfer(ethToBeTransferred);

        emit SwapTokenToEth(_amount, ethToBeTransferred);
    }

    /**
     * @notice Swaps one token for another token
     * @param srcToken The index of the source token to swap from
     * @param destToken The index of the destination token to swap to
     * @param _amount The amount of the source token to swap
     * @dev The caller must approve the contract to transfer the specified amount of the source token
     */

    function swapTokenToToken(
        uint8 srcToken,
        uint8 destToken,
        uint256 _amount
    )
        public
        nullToken
        NotToken(srcToken)
        validAmount(_amount)
        nonReentrant
        NotToken(destToken)
    {
        require(msg.sender != address(0), "Invalid sender address");

        require(destToken != srcToken, "Tokens must differ");
        uint256 userBalance = getBalance(srcToken, msg.sender);
        require(_amount < userBalance + 1, "Not enough source tokens");

        uint256 contractBalance = getBalance(destToken, self);
        require(_amount < contractBalance + 1, "Insufficient tokens");

        ERC20 srcTokenData = tokensMap[srcToken];
        ERC20 destTokenData = tokensMap[destToken];

        bool successSrc = srcTokenData.transferFrom(msg.sender, self, _amount);
        require(successSrc, "Transfer failed");

        bool successDest = destTokenData.transfer(msg.sender, _amount);
        require(successDest, "Transfer failed");

        emit SwapTokenToToken(_amount);
    }
    /**
     * @notice Withdraw Ether from the contract.
     * @dev Only the owner can call this function. This function is protected against
     *      reentrancy attacks by using the `nonReentrant` modifier and restricts gas usage
     *      to prevent potential gas-related attacks. The amount of Ether to withdraw should
     *      not exceed the contract's balance.
     * @param amount The amount of Ether to withdraw.
     *
     * Requirements:
     * - The caller must be the owner of the contract.
     * - The contract must have at least `amount` Ether in its balance.
     * - The Ether transfer must succeed.
     */
    function withdraw(
        uint256 amount
    ) external validAmount(amount) onlyOwner nonReentrant {
        require(address(this).balance >= amount, "Insufficient balance");

        (bool success, ) = payable(owner).call{value: amount, gas: 2300}("");
        require(success, "Transfer failed.");

        emit Withdrawal(owner, amount);
    }
    /**
     * @notice Returns the balance of a specified token for a given address
     * @param token The index of the token
     * @param _address The address to query the balance for
     * @return The balance of the specified token for the given address
     */

    function getBalance(
        uint8 token,
        address _address
    ) public view nullToken NotToken(token) returns (uint256) {
        return tokensMap[token].balanceOf(_address);
    }

    /**
     * @notice Returns the name of a specified token
     * @param token The index of the token
     * @return The name of the specified token
     */

    function getName(
        uint8 token
    ) public view nullToken NotToken(token) returns (string memory) {
        return tokensMap[token].name();
    }

    /**
     * @notice Returns the contract address of a specified token
     * @param token The index of the token
     * @return The contract address of the specified token
     */

    function getTokenAddress(
        uint8 token
    ) public view nullToken NotToken(token) returns (address) {
        return address(tokensMap[token]);
    }

    /**
     * @notice Returns the Ether balance of the contract
     * @return The Ether balance of the contract
     */

    function getEthBalance() public view returns (uint256) {
        return self.balance;
    }
}
