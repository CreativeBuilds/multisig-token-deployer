const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MultiSigWallet", function () {
    let MultiSigWallet;
    let multiSigWallet;
    let owner1;
    let owner2;
    let owner3;
    let deployer;
    let addr1;
    let addr2;
    let addr3;
    
    beforeEach(async function () {
        [deployer, owner1, owner2, owner3, addr1, addr2, addr3] = await ethers.getSigners();
        
        MultiSigWallet = await ethers.getContractFactory("MultiSigWallet");
        multiSigWallet = await MultiSigWallet.deploy([owner1.address, owner2.address, owner3.address], 2);
        await multiSigWallet.waitForDeployment();
    });
    
    describe("Deployment", function () {
        it("Should set the correct owner", async function () {
            const OWNER_ROLE = await multiSigWallet.OWNER_ROLE();
            expect(await multiSigWallet.hasRole(OWNER_ROLE, deployer.address)).to.be.true;
        });
        
        it("Should set the correct voters", async function () {
            const VOTER_ROLE = await multiSigWallet.VOTER_ROLE();
            expect(await multiSigWallet.hasRole(VOTER_ROLE, owner1.address)).to.be.true;
            expect(await multiSigWallet.hasRole(VOTER_ROLE, owner2.address)).to.be.true;
            expect(await multiSigWallet.hasRole(VOTER_ROLE, owner3.address)).to.be.true;
        });
        
        it("Should set the correct required signatures", async function () {
            expect(await multiSigWallet.requiredSignatures()).to.equal(2);
        });
        
        it("Should not deploy with no voters", async function () {
            await expect(MultiSigWallet.deploy([], 1))
                .to.be.revertedWithCustomError(multiSigWallet, "NoVotersProvided");
        });
        
        it("Should not deploy with invalid required signatures", async function () {
            await expect(MultiSigWallet.deploy([owner1.address], 2))
                .to.be.revertedWithCustomError(multiSigWallet, "InvalidRequiredSignatures");
        });
    });
    
    describe("Transaction Management", function () {
        it("Should create a transaction", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            const tx = await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            const receipt = await tx.wait();
            
            expect(receipt.logs[0].args.txId).to.equal(0);
            expect(receipt.logs[0].args.to).to.equal(addr1.address);
            expect(receipt.logs[0].args.value).to.equal(value);
        });
        
        it("Should allow signing a transaction", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            
            const tx = await multiSigWallet.connect(owner1).signTransaction(0);
            const receipt = await tx.wait();
            
            expect(receipt.logs[0].args.txId).to.equal(0);
            expect(receipt.logs[0].args.signer).to.equal(owner1.address);
        });
        
        it("Should not allow signing twice", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            await multiSigWallet.connect(owner1).signTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).signTransaction(0))
                .to.be.revertedWithCustomError(multiSigWallet, "AlreadySigned");
        });
        
        it("Should execute transaction with enough signatures", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            await multiSigWallet.connect(owner1).signTransaction(0);
            await multiSigWallet.connect(owner2).signTransaction(0);
            
            await deployer.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("0.2")
            });
            
            const tx = await multiSigWallet.connect(owner1).executeTransaction(0);
            const receipt = await tx.wait();
            
            expect(receipt.logs[0].args.txId).to.equal(0);
        });
        
        it("Should not execute transaction without enough signatures", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            await multiSigWallet.connect(owner1).signTransaction(0);
            
            await expect(multiSigWallet.connect(owner1).executeTransaction(0))
                .to.be.revertedWithCustomError(multiSigWallet, "NotEnoughSignatures");
        });
    });
    
    describe("Voter Management", function () {
        it("Should add new voter", async function () {
            await multiSigWallet.connect(deployer).addVoter(addr1.address);
            expect(await multiSigWallet.hasRole(await multiSigWallet.VOTER_ROLE(), addr1.address)).to.be.true;
        });
        
        it("Should remove voter", async function () {
            await multiSigWallet.connect(deployer).removeVoter(owner3.address);
            expect(await multiSigWallet.hasRole(await multiSigWallet.VOTER_ROLE(), owner3.address)).to.be.false;
        });
        
        it("Should not add existing voter", async function () {
            await expect(multiSigWallet.connect(deployer).addVoter(owner1.address))
                .to.be.revertedWithCustomError(multiSigWallet, "AlreadyVoter");
        });
        
        it("Should not remove non-voter", async function () {
            await expect(multiSigWallet.connect(deployer).removeVoter(addr1.address))
                .to.be.revertedWithCustomError(multiSigWallet, "NotVoter");
        });
        
        it("Should update required signatures", async function () {
            await multiSigWallet.connect(deployer).updateRequiredSignatures(3);
            expect(await multiSigWallet.requiredSignatures()).to.equal(3);
        });
        
        it("Should not update required signatures to zero", async function () {
            await expect(multiSigWallet.connect(deployer).updateRequiredSignatures(0))
                .to.be.revertedWithCustomError(multiSigWallet, "InvalidRequiredSignaturesCount");
        });
    });
    
    describe("Access Control", function () {
        it("Should not allow non-owners to create transactions", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await expect(multiSigWallet.connect(addr1).createTransaction(addr2.address, value, data))
                .to.be.reverted;
        });
        
        it("Should not allow non-voters to sign transactions", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            
            await expect(multiSigWallet.connect(addr1).signTransaction(0))
                .to.be.reverted;
        });
        
        it("Should not allow non-voters to execute transactions", async function () {
            const data = "0x";
            const value = ethers.parseEther("0.1");
            await multiSigWallet.connect(deployer).createTransaction(addr1.address, value, data);
            await multiSigWallet.connect(owner1).signTransaction(0);
            await multiSigWallet.connect(owner2).signTransaction(0);
            
            await expect(multiSigWallet.connect(addr1).executeTransaction(0))
                .to.be.reverted;
        });
    });
    
    describe("Batched Transactions", function () {
        let batchId;
        let transactions;
        
        beforeEach(async function () {
            // Create a batch of transactions
            transactions = [
                {
                    to: addr1.address,
                    value: ethers.parseEther("0.1"),
                    data: "0x"
                },
                {
                    to: addr2.address,
                    value: ethers.parseEther("0.2"),
                    data: "0x"
                },
                {
                    to: addr3.address,
                    value: ethers.parseEther("0.3"),
                    data: "0x"
                }
            ];
            
            // Create batch transaction
            const tx = await multiSigWallet.connect(deployer).createBatchTransaction(transactions);
            batchId = await tx.wait().then(receipt => receipt.logs[0].args.batchId);
        });
        
        it("Should create a batch transaction", async function () {
            expect(batchId).to.equal(0);
            const batch = await multiSigWallet.getBatchTransaction(batchId);
            expect(batch.length).to.equal(3);
            
            // Verify transaction details
            expect(batch[0].to).to.equal(addr1.address);
            expect(batch[0].value).to.equal(ethers.parseEther("0.1"));
            expect(batch[1].to).to.equal(addr2.address);
            expect(batch[1].value).to.equal(ethers.parseEther("0.2"));
            expect(batch[2].to).to.equal(addr3.address);
            expect(batch[2].value).to.equal(ethers.parseEther("0.3"));
        });
        
        it("Should not create an empty batch", async function () {
            await expect(
                multiSigWallet.connect(deployer).createBatchTransaction([])
            ).to.be.revertedWithCustomError(multiSigWallet, "EmptyBatch");
        });
        
        it("Should allow voters to sign batch transaction", async function () {
            await multiSigWallet.connect(owner1).signBatchTransaction(batchId);
            await multiSigWallet.connect(owner2).signBatchTransaction(batchId);
            
            const status = await multiSigWallet.getBatchStatus(batchId);
            expect(status.signatureCount).to.equal(2);
        });
        
        it("Should not allow non-voters to sign batch transaction", async function () {
            await expect(
                multiSigWallet.connect(addr1).signBatchTransaction(batchId)
            ).to.be.revertedWithCustomError(multiSigWallet, "AccessControlUnauthorizedAccount");
        });
        
        it("Should not allow double signing of batch transaction", async function () {
            await multiSigWallet.connect(owner1).signBatchTransaction(batchId);
            await expect(
                multiSigWallet.connect(owner1).signBatchTransaction(batchId)
            ).to.be.revertedWithCustomError(multiSigWallet, "AlreadySigned");
        });
        
        it("Should execute batch transaction with enough signatures", async function () {
            // Fund the multisig wallet
            await deployer.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // Sign the batch
            await multiSigWallet.connect(owner1).signBatchTransaction(batchId);
            await multiSigWallet.connect(owner2).signBatchTransaction(batchId);
            
            // Execute the batch
            const tx = await multiSigWallet.connect(owner1).executeBatchTransaction(batchId);
            await tx.wait();
            
            const status = await multiSigWallet.getBatchStatus(batchId);
            expect(status.executed).to.be.true;
        });
        
        it("Should not execute batch transaction without enough signatures", async function () {
            await multiSigWallet.connect(owner1).signBatchTransaction(batchId);
            await expect(
                multiSigWallet.connect(owner1).executeBatchTransaction(batchId)
            ).to.be.revertedWithCustomError(multiSigWallet, "BatchNotEnoughSignatures");
        });
        
        it("Should not execute already executed batch transaction", async function () {
            // Fund the multisig wallet
            await deployer.sendTransaction({
                to: await multiSigWallet.getAddress(),
                value: ethers.parseEther("1.0")
            });
            
            // Sign and execute the batch
            await multiSigWallet.connect(owner1).signBatchTransaction(batchId);
            await multiSigWallet.connect(owner2).signBatchTransaction(batchId);
            await multiSigWallet.connect(owner1).executeBatchTransaction(batchId);
            
            // Try to execute again
            await expect(
                multiSigWallet.connect(owner1).executeBatchTransaction(batchId)
            ).to.be.revertedWithCustomError(multiSigWallet, "BatchAlreadyExecuted");
        });
        
        it("Should check if address has signed batch", async function () {
            await multiSigWallet.connect(owner1).signBatchTransaction(batchId);
            
            expect(await multiSigWallet.hasSignedBatch(batchId, owner1.address)).to.be.true;
            expect(await multiSigWallet.hasSignedBatch(batchId, owner2.address)).to.be.false;
        });
    });
}); 