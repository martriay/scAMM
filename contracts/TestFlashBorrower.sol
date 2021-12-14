// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156.sol";

contract TestFlashBorrower is IERC3156FlashBorrower {
    address public tokenAddress;

    constructor(address _token) {
        require(_token != address(0), "invalid token address");
        tokenAddress = _token;
    }

    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external override returns (bytes32) {
        require(address(this).balance > fee, "Need ETH");
        require(IERC20(tokenAddress).balanceOf(address(this)) > fee, "Need token");

        if (token == address(0)) {
            payable(msg.sender).transfer(amount + fee);
        } else {
            IERC20(tokenAddress).transfer(msg.sender, amount + fee);
        }

        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }

    receive() external payable {}
}
