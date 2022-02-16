const { expect } = require("chai");
const { ethers, waffle } = require("hardhat");

let token;
let exchange;

let tx;

let deployer, bob;

describe("Liquidity", function () {
  beforeEach(async function () {
    const totalSupply = ethers.utils.parseEther("10000");

    [deployer, bob] = await ethers.getSigners();
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy("Ferneth", "FTH", totalSupply);
    await token.deployed();

    const Exchange = await ethers.getContractFactory("Exchange");
    exchange = await Exchange.deploy(token.address)
  });

  /**
   * Agrega amountA del token FTH y amountB de ETH
   * Como es la primera vez que se agrega liquidez, el
   * valor del LP minteado es amountB
   */
  it("add liquidity, four times 100 ethers and 200 FTH", async function () {
    const amountA = ethers.utils.parseEther("200");
    const amountB = ethers.utils.parseEther("100");

    for(let i = 1; i < 4; i++) {
      await token.approve(exchange.address, amountA);
      let tx = exchange.addLiquidity(amountA, { value: amountB });
      
      // el orden del testeo es importante, al cambiarlo falla waffle :S
      // await expect(() => tx)
      //   .to.changeTokenBalances(token, [deployer, exchange], [amountA.mul("-1"), amountA]);
    
      await expect(await tx)
        .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
        .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, amountA)
        .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);
      
      expect(await exchange.provider.getBalance(exchange.address)).to.equal(amountB.mul(i));
      expect(await exchange.getReserve()).to.equal(amountA.mul(i));
      expect(await exchange.balanceOf(deployer.address)).to.equal(amountB.mul(i));
    }
  });

  it("add liquidity, four times 0.01 ethers and 10 FTH", async function () {
    const amountA = ethers.utils.parseEther("0.01");
    const amountB = ethers.utils.parseEther("10");

    for(let i = 1; i < 4; i++) {
      await token.approve(exchange.address, amountA);
      let tx = exchange.addLiquidity(amountA, { value: amountB });
      
      // el orden del testeo es importante, al cambiarlo falla waffle :S
      // await expect(() => tx)
      //   .to.changeTokenBalances(token, [deployer, exchange], [amountA.mul("-1"), amountA]);
    
      await expect(await tx)
        .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
        .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, amountA)
        .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);
      
      expect(await exchange.provider.getBalance(exchange.address)).to.equal(amountB.mul(i));
      expect(await exchange.getReserve()).to.equal(amountA.mul(i));
      expect(await exchange.balanceOf(deployer.address)).to.equal(amountB.mul(i));
    }
  });

  it("cant fuck liquidity seding raw ETH", async function () {
    const tx = deployer.sendTransaction({
      to: exchange.address,
      value: ethers.utils.parseEther("0.01"),
    });
    
    await expect(tx).to.reverted;
  });

  it("cant fuck liquidity seding raw FTH", async function () {
    const amountA = ethers.utils.parseEther("0.01");
    const amountB = ethers.utils.parseEther("10");
    await token.approve(exchange.address, amountA.mul("10"));
    let tx = exchange.addLiquidity(amountA, { value: amountB });
    
    // el orden del testeo es importante, al cambiarlo falla waffle :S
    // await expect(() => tx)
    //   .to.changeTokenBalances(token, [deployer, exchange], [amountA.mul("-1"), amountA]);
  
    await expect(await tx)
      .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
      .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, amountA)
      .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);
    
      
    let ethReserve = await exchange.provider.getBalance(exchange.address);
    let tokenReserve = await exchange.getReserve();
    let tokenAmount = amountA.mul(tokenReserve).div(ethReserve);
    
    console.log("Ratio antes de enviar FTH", ethers.utils.formatEther(tokenAmount));
    await token.transfer(exchange.address, amountB);
          
    ethReserve = await exchange.provider.getBalance(exchange.address);
    tokenReserve = await exchange.getReserve();
    tokenAmount = amountA.mul(tokenReserve).div(ethReserve);

    console.log("Ratio despues de enviar FTH", ethers.utils.formatEther(tokenAmount));

    // agrego liquidez usando exactamente la misma cantidad que tiene el LP en ETH y FTH
    await expect(await tx)
      .to.changeEtherBalances([deployer, exchange], [ethReserve.mul("-1"), ethReserve])
      .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, tokenReserve)
      .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, ethReserve, tokenReserve);
    
    
  });
});