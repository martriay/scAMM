// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./Exchange.sol";

contract Registry {
    mapping(address => address) public tokenToExchange;

    event NewExchange(address indexed token, address indexed exchange);

    function createExchange(address _tokenAddress) public returns (address) {
        require(_tokenAddress != address(0), "invalid token address");
        require(
            tokenToExchange[_tokenAddress] == address(0),
            "exchange already exists"
        );

        Exchange exchange = new Exchange(_tokenAddress);
        tokenToExchange[_tokenAddress] = address(exchange);

        emit NewExchange(_tokenAddress, address(exchange));

        return address(exchange);
    }

    function getExchange(address _tokenAddress) public view returns (address) {
        return tokenToExchange[_tokenAddress];
    }
}
