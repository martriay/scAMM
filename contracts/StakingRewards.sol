// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "hardhat/console.sol";

contract StakingRewards {
    IERC20 public rewardsToken;
    IERC20 public stakingToken;

    uint public rewardRate = 100;
    uint public lastUpdateTime;
    uint public rewardPerTokenStored;

    mapping(address => uint) public userRewardPerTokenPaid;
    mapping(address => uint) public rewards;

    uint private _totalSupply;
    mapping(address => uint) private _balances;

    /* ========== CONSTRUCTOR ========== */
    constructor(address _stakingToken, address _rewardsToken) {
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
    }

    /* ========== VIEWS ========== */
    function totalSupply() external view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) external view returns (uint256) {
        return _balances[account];
    }

    function rewardPerToken() public view returns (uint) {
        //console.log("RewardsPerToken total supply: %s rewardPerTokenStored %s",_totalSupply,rewardPerTokenStored);
        if (_totalSupply == 0) {
            return rewardPerTokenStored;
        }
        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint) {
        return
            ((_balances[account] *
                (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) +
            rewards[account];
    }

    /* ========== MUTATIVE FUNCTIONS ========== */

    function stake(uint _amount) external updateReward(msg.sender) {
        require(_amount > 0, "Cannot stake 0");
        _totalSupply +=  _amount;
        _balances[msg.sender] += _amount;
        stakingToken.transferFrom(msg.sender, address(this), _amount);

        //console.log("Stake %s tokens", _amount);
    }

    function withdraw(uint _amount) public updateReward(msg.sender) {
        require(_amount > 0, "Cannot withdraw 0");
        _totalSupply -= _amount;
        _balances[msg.sender] -= _amount;
        stakingToken.transfer(msg.sender, _amount);

        //console.log("withdraw %s tokens \ntotal supply %s", _amount,_totalSupply);

    }

    function getReward() public updateReward(msg.sender) {
        //console.log("Rewards on get",  rewards[msg.sender],rewardPerTokenStored);
        uint reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            rewardsToken.transferFrom(address(this), msg.sender, reward);
        }

    }

    function exit() external {
        withdraw(_balances[msg.sender]);
        getReward();
    }

    /// @notice add the tokens to be distributed as rewards
    /// @param _amount token amount (token address is the one on constructor)
    function depositRewardsTokens(uint256 _amount) external {
        rewardsToken.transferFrom(msg.sender, address(this), _amount);
        rewardsToken.approve(address(this), _amount);
    }

    /* ========== MODIFIERS ========== */
    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

}

interface IERC20 {
    function totalSupply() external view returns (uint);

    function balanceOf(address account) external view returns (uint);

    function transfer(address recipient, uint amount) external returns (bool);

    function allowance(address owner, address spender) external view returns (uint);

    function approve(address spender, uint amount) external returns (bool);

    function transferFrom(
        address sender,
        address recipient,
        uint amount
    ) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);
}