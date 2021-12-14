// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/interfaces/IERC3156.sol";

interface IRegistry {
    function getExchange(address _tokenAddress) external returns (address);
}

contract Exchange is ERC20, IERC3156FlashLender {
    address public tokenAddress;
    address public registryAddress;

    uint256 public lockedEthAmount;
    uint256 public lockedTokenAmount;

    event TokenPurchase(address indexed buyer, uint256 indexed ethSold, uint256 indexed tokensBought);
    event EthPurchase(address indexed buyer, uint256 indexed tokensSold, uint256 indexed ethBought);
    event AddLiquidity(address indexed provider, uint256 indexed ethAmount, uint256 indexed tokenAmount);
    event RemoveLiquidity(address indexed provider, uint256 indexed ethAmount, uint256 indexed tokenAmount);

    constructor(address _token) ERC20("La Paternal", "LP") {
        require(_token != address(0), "invalid token address");
        tokenAddress = _token;
        registryAddress = msg.sender;
    }

    function addLiquidity(uint256 _tokenAmount)
        public
        payable
        returns (uint256)
    {
        uint256 liquidity;

        if (getReserve() == 0) {
            liquidity = getBalance();
        } else {
            // Enforce the ratio once the pool is initialized to preserve
            // prices, but not before to allow initialization.
            uint256 ethReserve = getBalance() - msg.value;
            uint256 tokenReserve = getReserve();
            uint256 tokenAmount = (msg.value * tokenReserve) / ethReserve;
            require(_tokenAmount >= tokenAmount, "insufficient token amount");
            liquidity = (totalSupply() * msg.value) / ethReserve;
        }

        IERC20 token = IERC20(tokenAddress);
        token.transferFrom(msg.sender, address(this), _tokenAmount);
        _mint(msg.sender, liquidity);

        emit AddLiquidity(msg.sender, msg.value, _tokenAmount);

        return liquidity;
    }

    function removeLiquidity(uint256 _amount)
        public
        returns (uint256, uint256)
    {
        require(_amount > 0, "invalid amount");

        uint256 supply = totalSupply();
        uint256 ethAmount = (getBalance() * _amount) / supply;
        uint256 tokenAmount = (getReserve() * _amount) / supply;

        _burn(msg.sender, _amount);
        payable(msg.sender).transfer(ethAmount);
        IERC20(tokenAddress).transfer(msg.sender, tokenAmount);

        emit RemoveLiquidity(msg.sender, ethAmount, tokenAmount);

        return (ethAmount, tokenAmount);
    }

    function getReserve() public view returns (uint256) {
        return IERC20(tokenAddress).balanceOf(address(this)) - lockedTokenAmount;
    }

    function getBalance() public view returns (uint256) {
        return address(this).balance - lockedEthAmount;
    }

    function getAmount(
        uint256 inputAmount,
        uint256 inputReserve,
        uint256 outputReserve
    ) private pure returns (uint256) {
        require(inputReserve > 0 && outputReserve > 0, "invalid reserves");

        uint256 inputAmountWithFee = inputAmount * 99;
        uint256 numerator = inputAmountWithFee * outputReserve;
        uint256 denominator = (inputReserve * 100) + inputAmountWithFee;

        // return (inputAmount * outputReserve) / (inputReserve + inputAmount);
        return numerator / denominator;
    }

    function getTokenAmount(uint256 _ethSold) public view returns (uint256) {
        require(_ethSold > 0, "ethSold cannot be zero");
        uint256 ethReserve = getBalance();
        uint256 tokenReserve = getReserve();
        return getAmount(_ethSold, ethReserve, tokenReserve);
    }

    function getEthAmount(uint256 _tokenSold) public view returns (uint256) {
        require(_tokenSold > 0, "tokenSold cannot be zero");
        uint256 tokenReserve = getReserve();
        uint256 ethReserve = getBalance();
        return getAmount(_tokenSold, tokenReserve, ethReserve);
    }

    function ethToToken(uint256 _minTokens, address recipient) private {
        uint256 ethReserve = getBalance();
        uint256 tokenReserve = getReserve();
        uint256 tokensBought = getAmount(
            msg.value,
            ethReserve - msg.value,
            tokenReserve
        );

        require(tokensBought >= _minTokens, "insufficient output amount");
        IERC20(tokenAddress).transfer(recipient, tokensBought);

        emit TokenPurchase(msg.sender, msg.value, tokensBought);
    }

    function ethToTokenSwap(uint256 _minTokens) public payable {
        ethToToken(_minTokens, msg.sender);
    }

    function ethToTokenTransfer(uint256 _minTokens, address _recipient)
        public
        payable
    {
        ethToToken(_minTokens, _recipient);
    }

    function tokenToEthSwap(uint256 _tokensSold, uint256 _minEth) public {
        uint256 tokenReserve = getReserve();
        uint256 ethReserve = getBalance();
        uint256 ethBought = getAmount(
            _tokensSold,
            tokenReserve,
            ethReserve
        );

        require(ethBought >= _minEth, "insufficient output amount");

        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );
        payable(msg.sender).transfer(ethBought);

        emit EthPurchase(msg.sender, ethBought, _tokensSold);
    }

    function tokenToTokenSwap(
        uint256 _tokensSold,
        uint256 _minTokensBought,
        address _tokenAddress
    ) public {
        address exchangeAddress = IRegistry(registryAddress).getExchange(
            _tokenAddress
        );

        require(
            exchangeAddress != address(this) && exchangeAddress != address(0),
            "invalid exchange address"
        );

        uint256 tokenReserve = getReserve();
        uint256 ethReserve = getBalance();
        uint256 ethBought = getAmount(
            _tokensSold,
            tokenReserve,
            ethReserve
        );

        IERC20(tokenAddress).transferFrom(
            msg.sender,
            address(this),
            _tokensSold
        );

        Exchange(exchangeAddress).ethToTokenTransfer{value: ethBought}(
            _minTokensBought,
            msg.sender
        );
    }

    function maxFlashLoan(address token) external view override returns (uint256) {
        require(token == address(0) || token == tokenAddress, "ETH or Token lending only");
        return token == address(0) ? getBalance() : getReserve();
    }

    function flashFee(address token, uint256 amount) external view override returns (uint256) {
        require(token == address(0) || token == tokenAddress, "ETH or Token lending only");
        require(amount > 0, "Borrow some first");
        return 0;
    }

    function flashLoan(
        IERC3156FlashBorrower receiver,
        address token,
        uint256 amount,
        bytes calldata data
    ) external override returns (bool) {
        require(token == address(0) || token == tokenAddress, "ETH or Token lending only");

        uint256 beforeEthReserve = getBalance();
        uint256 beforeTokenReserve = getReserve();

        uint256 beforeAmount = token == address(0) ? beforeEthReserve : beforeTokenReserve;

        require(beforeAmount >= amount, "Not enough to borrow");

        uint256 fee = 0;

        uint256 lockTokenAmount = getAmount(
            amount,
            beforeEthReserve,
            beforeTokenReserve
        );
        uint256 lockEthAmount = getAmount(
            amount,
            beforeTokenReserve,
            beforeEthReserve
        );

        if (token == address(0)) {
            lockedTokenAmount = lockedTokenAmount + lockTokenAmount;
            payable(address(receiver)).transfer(amount);
        } else {
            lockedEthAmount = lockedEthAmount + lockEthAmount;
            IERC20(tokenAddress).transfer(address(receiver), amount);
        }

        require(
            receiver.onFlashLoan(msg.sender, token, amount, fee, data) == keccak256("ERC3156FlashBorrower.onFlashLoan"),
            "IERC3156: Callback failed"
        );

        uint256 afterEthReserve = getBalance();
        uint256 afterTokenReserve = getReserve();

        uint256 afterAmount = token == address(0) ? afterEthReserve : afterTokenReserve;

        require(afterAmount == beforeAmount + fee, "Give back the money");

        if (token == address(0)) {
            lockedTokenAmount = lockedTokenAmount - lockTokenAmount;
        } else {
            lockedEthAmount = lockedEthAmount - lockEthAmount;
        }

        return true;
    }
}
