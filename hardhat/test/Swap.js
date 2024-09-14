const {
  loadFixture,
} = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const { expect } = require("chai");
const { ethers } = require("hardhat");
const tokenContract = require("../artifacts/contracts/Token.sol/SimpleToken.json");
describe("Swap", () => {
  const deploy = async () => {
    const [owner, isNotOwner] = await ethers.getSigners();
    const Swap = await ethers.getContractFactory("Swap");
    const swap = await Swap.deploy();

    return {
      swap,
      owner,
      isNotOwner,
    };
  };

  describe("Deployment", () => {
    it("Should set the right owner", async () => {
      const { swap, owner } = await loadFixture(deploy);
      expect(await swap.owner()).to.equal(owner);
    });
    it("Should set the right contract address", async () => {
      const { swap } = await loadFixture(deploy);
      const address = await swap.getAddress();
      expect(await swap.self()).to.equal(address);
    });
  });
  describe("createToken", () => {
    describe("Validations", () => {
      it("Should revert with the right error if called from another account", async () => {
        const { swap, isNotOwner } = await loadFixture(deploy);

        await expect(
          swap
            .connect(isNotOwner)
            .createToken("test", "TST", ethers.encodeBytes32String("Test"))
        ).to.be.revertedWithCustomError(swap, "OwnerErr");
      });
      it("Should revert with the right error if count_Tokens > 3", async () => {
        const { swap } = await loadFixture(deploy);
        for (let index = 0; index < 3; index++) {
          const salt = ethers.encodeBytes32String((index + 1).toString());
          await swap.createToken("test", "TST", salt);
        }
        await expect(
          swap.createToken("test", "TST", ethers.encodeBytes32String("Test"))
        ).to.be.revertedWithCustomError(swap, "Token");
      });
    });
    describe("Event", () => {
      it("Should emit an event on TokenDeployed", async () => {
        const { swap } = await loadFixture(deploy);
        await expect(
          swap.createToken("test", "TST", ethers.encodeBytes32String("Test"))
        ).to.be.emit(swap, "TokenDeployed");
      });
    });
    describe("Executed", () => {
      it("Should token created", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        expect(await swap.getName(0)).to.be.equal("test");
      });
    });
  });
  describe("swapEthToToken", () => {
    describe("Validations", () => {
      it("Should revert with the right error if count_Tokens = 0", async () => {
        const { swap } = await loadFixture(deploy);
        await expect(
          swap.swapEthToToken(0, { value: ethers.parseEther("10") })
        ).to.be.revertedWithCustomError(swap, "Token");
      });
      it("Should revert with the right error if token >= count_Tokens", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        await expect(
          swap.swapEthToToken(1, { value: ethers.parseEther("10") })
        ).to.be.revertedWithCustomError(swap, "Token");
      });
      it("Should revert with the right error if getBalance(token, self) <= outputValue - 1", async () => {
        const { swap, isNotOwner } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        await swap.swapEthToToken(0, { value: ethers.parseEther("9999.0") });
        await expect(
          swap
            .connect(isNotOwner)
            .swapEthToToken(0, { value: ethers.parseEther("9999.0") })
        ).to.be.revertedWith("Insufficient tokens");
      });
    });
    describe("Event", () => {
      it("Should emit an event on swapEthToToken", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );

        await expect(
          swap.swapEthToToken(0, { value: ethers.parseEther("99.0") })
        ).to.be.emit(swap, "SwapEthToToken");
      });
    });
    describe("Executed", () => {
      it("Should swap eth to token", async () => {
        const { swap, owner } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        const address = await swap.self();
        const balanceContract = await swap.getBalance(0, address);
        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const newBalanceContract = await swap.getBalance(0, address);

        expect(await swap.getBalance(0, owner)).to.be.equal(
          balanceContract - newBalanceContract
        );
      });
    });
  });
  describe("swapTokenToEth", () => {
    describe("Validations", () => {
      it("Should revert with the right error if count_Tokens = 0", async () => {
        const { swap } = await loadFixture(deploy);
        await expect(
          swap.swapTokenToEth(0, 1000)
        ).to.be.revertedWithCustomError(swap, "Token");
      });
      it("Should revert with the right error if token >= count_Tokens", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        await expect(swap.swapTokenToEth(1, 500)).to.be.revertedWithCustomError(
          swap,
          "Token"
        );
      });
      it("Should revert with the right error if _amount < 0", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });

        await expect(swap.swapTokenToEth(0, 0)).to.be.revertedWith(
          "Amount must be greater than zero"
        );
      });
      it("Should revert with the right error if _amount >= balance + 1", async () => {
        const { swap, owner } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );

        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const balance = await swap.getBalance(0, owner);

        await expect(
          swap.swapTokenToEth(0, balance + BigInt(1))
        ).to.be.revertedWith("Not enough tokens");
      });

      it("Should revert with the right error if  availableEthBalance + 1 <= ethToBeTransferred", async () => {
        const { swap, owner } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );

        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const balance = await swap.getBalance(0, owner);
        await swap.withdraw(ethers.parseEther("100"));
        await expect(swap.swapTokenToEth(0, balance)).to.be.revertedWith(
          "Dex is running low on balance"
        );
      });
    });
    describe("Event", () => {
      it("Should emit an event on swapTokenToEth", async () => {
        const { swap, owner } = await loadFixture(deploy);

        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        const addressToken = await swap.getTokenAddress(0);
        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const balance = await swap.getBalance(0, owner);
        const addressContract = await swap.getAddress();
        const contract = new ethers.Contract(
          addressToken,
          tokenContract.abi,
          ethers.provider
        );
        await contract.connect(owner).approve(addressContract, balance);
        await expect(swap.swapTokenToEth(0, balance)).to.be.emit(
          swap,
          "SwapTokenToEth"
        );
      });
    });
    describe("Executed", () => {
      it("Should swap token to eth", async () => {
        const { swap, owner } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        const addressToken = await swap.getTokenAddress(0);
        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const balance = await swap.getBalance(0, owner);
        const addressContract = await swap.getAddress();
        const contract = new ethers.Contract(
          addressToken,
          tokenContract.abi,
          ethers.provider
        );
        await contract.connect(owner).approve(addressContract, balance);
        await swap.swapTokenToEth(0, balance);

        expect(await swap.getBalance(0, owner)).to.be.equal(0);
      });
    });
  });
  describe("swapTokenToToken", () => {
    describe("Validations", () => {
      it("Should revert with the right error if count_Tokens = 0", async () => {
        const { swap } = await loadFixture(deploy);
        await expect(
          swap.swapTokenToToken(0, 0, 0)
        ).to.be.revertedWithCustomError(swap, "Token");
      });
      it("Should revert with the right error if srcToken >= count_Tokens", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        await expect(
          swap.swapTokenToToken(1, 1, 0)
        ).to.be.revertedWithCustomError(swap, "Token");
      });
      it("Should revert with the right error if _amount < 0", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );

        await expect(swap.swapTokenToToken(0, 0, 0)).to.be.revertedWith(
          "Amount must be greater than zero"
        );
      });
      it("Should revert with the right error if destToken >= count_Tokens", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );
        await expect(
          swap.swapTokenToToken(0, 1, 10)
        ).to.be.revertedWithCustomError(swap, "Token");
      });

      it("Should revert with the right error if destToken == srcToken", async () => {
        const { swap } = await loadFixture(deploy);
        await swap.createToken(
          "test",
          "TST",
          ethers.encodeBytes32String("Test")
        );

        await expect(swap.swapTokenToToken(0, 0, 10)).to.be.revertedWith(
          "Tokens must differ"
        );
      });
      it("Should revert with the right error if _amount >= userBalance + 1", async () => {
        const { swap } = await loadFixture(deploy);
        for (let index = 0; index < 2; index++) {
          await swap.createToken(
            "test",
            "TST",
            ethers.encodeBytes32String((index + 1).toString())
          );
        }
        await expect(swap.swapTokenToToken(0, 1, 10)).to.be.revertedWith(
          "Not enough source tokens"
        );
      });
      it("Should revert with the right error if _amount >= userBalance + 1", async () => {
        const { swap } = await loadFixture(deploy);
        for (let index = 0; index < 2; index++) {
          await swap.createToken(
            "test",
            "TST",
            ethers.encodeBytes32String((index + 1).toString())
          );
        }
        await expect(swap.swapTokenToToken(0, 1, 10)).to.be.revertedWith(
          "Not enough source tokens"
        );
      });
      it("Should revert with the right error if _amount >= contractBalance + 1", async () => {
        const { swap, isNotOwner, owner } = await loadFixture(deploy);
        for (let index = 0; index < 2; index++) {
          await swap.createToken(
            "test",
            "TST",
            ethers.encodeBytes32String((index + 1).toString())
          );
        }
        await swap.swapEthToToken(0, { value: ethers.parseEther("9999.0") });
        const balance = await swap.getBalance(0, owner);
        await swap
          .connect(isNotOwner)
          .swapEthToToken(1, { value: ethers.parseEther("9999.0") });
        await expect(swap.swapTokenToToken(0, 1, balance)).to.be.revertedWith(
          "Insufficient tokens"
        );
      });
    });
    describe("Event", () => {
      it("Should emit an event on SwapTokenToToken", async () => {
        const { swap, owner } = await loadFixture(deploy);

        for (let index = 0; index < 2; index++) {
          await swap.createToken(
            "test",
            "TST",
            ethers.encodeBytes32String((index + 1).toString())
          );
        }
        const addressToken = await swap.getTokenAddress(0);
        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const balance = await swap.getBalance(0, owner);
        const addressContract = await swap.getAddress();
        const contract = new ethers.Contract(
          addressToken,
          tokenContract.abi,
          ethers.provider
        );
        await contract.connect(owner).approve(addressContract, balance);
        await expect(swap.swapTokenToToken(0, 1, balance)).to.be.emit(
          swap,
          "SwapTokenToToken"
        );
      });
    });
    describe("Executed", () => {
      it("Should swap token to Token", async () => {
        const { swap, owner } = await loadFixture(deploy);

        for (let index = 0; index < 2; index++) {
          await swap.createToken(
            "test",
            "TST",
            ethers.encodeBytes32String((index + 1).toString())
          );
        }
        const addressToken = await swap.getTokenAddress(0);
        await swap.swapEthToToken(0, { value: ethers.parseEther("100") });
        const balance = await swap.getBalance(0, owner);
        const addressContract = await swap.getAddress();
        const contract = new ethers.Contract(
          addressToken,
          tokenContract.abi,
          ethers.provider
        );
        await contract.connect(owner).approve(addressContract, balance);
        await swap.swapTokenToToken(0, 1, balance);

        expect(await swap.getBalance(0, owner)).to.be.equal(0);
      });
    });
  });

  describe("withdraw", () => {
    describe("Validations", () => {
      it("Should revert with the right error if called from another account", async () => {
        const { swap, isNotOwner } = await loadFixture(deploy);

        await expect(
          swap.connect(isNotOwner).withdraw(ethers.parseEther("1.0"))
        ).to.be.revertedWithCustomError(swap, "OwnerErr");
      });
      it("Should revert with the right error if _amount < 0", async () => {
        const { swap } = await loadFixture(deploy);
        await expect(swap.withdraw(0)).to.be.revertedWith(
          "Amount must be greater than zero"
        );
      });
      it("Should revert with the right error if amount > balance", async () => {
        const { swap } = await loadFixture(deploy);
        await expect(
          swap.withdraw(ethers.parseEther("1.0"))
        ).to.be.revertedWith("Insufficient balance");
      });
    });
    describe("Event", () => {
      it("Should emit an event on TokenDeployed", async () => {
        const { swap, owner } = await loadFixture(deploy);
        const address = await swap.getAddress();
        const tx = await owner.sendTransaction({
          to: address,
          value: ethers.parseEther("100.0"), // Sending 1 Ether
        });
        await tx.wait();
        await expect(swap.withdraw(ethers.parseEther("100.0"))).to.be.emit(
          swap,
          "Withdrawal"
        );
      });
    });
    describe("Executed", () => {
      it("Should ether withdraw", async () => {
        const { swap, owner } = await loadFixture(deploy);
        const address = await swap.getAddress();
        const tx = await owner.sendTransaction({
          to: address,
          value: ethers.parseEther("100.0"), // Sending 1 Ether
        });
        await swap.withdraw(ethers.parseEther("100.0"));
        expect(await swap.getEthBalance()).to.be.equal(0);
      });
    });
  });
});
