// SPDX-License-Identifier: MIT
pragma solidity ^0.8;
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

    constructor(address _stakingToken, address _rewardsToken) {
        stakingToken = IERC20(_stakingToken);
        rewardsToken = IERC20(_rewardsToken);
    }

    function depositStakingTokens(uint256 _amount) external {
        rewardsToken.transferFrom(msg.sender, address(this), _amount);
        rewardsToken.approve(address(this), _amount);
    }

    function rewardPerToken() public view returns (uint) {
        if (_totalSupply == 0) {
            return 0;
        }
        return
            rewardPerTokenStored +
            (((block.timestamp - lastUpdateTime) * rewardRate * 1e18) / _totalSupply);
    }

    function earned(address account) public view returns (uint) {
        // console.log("balance:", _balances[account]);
        // console.log("rewards per token:", rewardPerToken());
        // console.log("rest:", (rewardPerToken() - userRewardPerTokenPaid[account]) / 1e18);        
        // console.log("rewards:", rewards[account]);
        return
            ((_balances[account] *
                (rewardPerToken() - userRewardPerTokenPaid[account])) / 1e18) +
            rewards[account];
    }

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = block.timestamp;

        rewards[account] = earned(account);
        userRewardPerTokenPaid[account] = rewardPerTokenStored;
        _;
    }

    function stake(uint _amount) external updateReward(msg.sender) {
        _totalSupply += _amount;
        //console.log("Update total supply");
        _balances[msg.sender] += _amount;
        //console.log("Update balance for", msg.sender);
        stakingToken.transferFrom(msg.sender, address(this), _amount);
        //console.log("Transfered the rewards");

    }

    function withdraw(uint _amount) external updateReward(msg.sender) {
        _totalSupply -= _amount;
        _balances[msg.sender] -= _amount;
        stakingToken.transfer(msg.sender, _amount);
    }

    function getReward() external updateReward(msg.sender) {
        console.log("Rewards on get",  rewards[msg.sender]);
        uint reward = rewards[msg.sender];
        rewards[msg.sender] = 0;
        rewardsToken.transferFrom(address(this), msg.sender, reward);

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