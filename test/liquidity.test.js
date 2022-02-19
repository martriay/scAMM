const { expect } = require("chai");
const { ethers } = require("hardhat");

let token;
let exchange;

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

  describe('Fuck addLiquidity', function() {
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
      // apruebo de mas para hacer el approve una sola vez
      await token.approve(exchange.address, ethers.constants.MaxUint256);

      // agrego liquidez una vez
      let tx = exchange.addLiquidity(amountA, { value: amountB });
      await expect(await tx)
        .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
        .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, amountA)
        .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);

      // agrego liquidez por segunda vez con el mismo ratio
      tx = exchange.addLiquidity(amountA, { value: amountB });
      await expect(await tx)
        .to.changeEtherBalances([deployer, exchange], [amountB.mul("-1"), amountB])
        .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, amountA)
        .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, amountB, amountA);
      
      // agrego el token FTH al pool por transferencia, cambiando el ratio
      await token.transfer(exchange.address, amountB.div("20"));

      // agrego liquidez por tercera vez despues de joder el ratio, esto tiene que fallar
      expect(exchange.addLiquidity(amountA, { value: amountB })).to.be.revertedWith("insufficient token amount");
      
      const tokenReserve = await exchange.getReserve();
      const ethReserve = await exchange.provider.getBalance(exchange.address);

      const newAmountA = tokenReserve.div("10");
      const newAmountB = ethReserve.div("10");
      
      tx = exchange.addLiquidity(newAmountA, { value: newAmountB });
      
      // agrego liquidez usando exactamente la misma cantidad que tiene el LP en ETH y FTH
      await expect(await tx)
        .to.changeEtherBalances([deployer, exchange], [newAmountB.mul("-1"), newAmountB])
        .to.emit(token, "Transfer").withArgs(deployer.address, exchange.address, newAmountA)
        .to.emit(exchange, "AddLiquidity").withArgs(deployer.address, newAmountB, newAmountA);

    });
  });
});