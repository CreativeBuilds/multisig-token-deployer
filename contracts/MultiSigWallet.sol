// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract MultiSigWallet is AccessControl, ReentrancyGuard {
    bytes32 public constant OWNER_ROLE = keccak256("OWNER_ROLE");
    bytes32 public constant VOTER_ROLE = keccak256("VOTER_ROLE");
    
    uint256 public requiredSignatures;
    uint256 public transactionCount;
    
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 signatureCount;
    }
    
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public signatures;
    
    event TransactionCreated(uint256 indexed txId, address indexed to, uint256 value, bytes data);
    event TransactionSigned(uint256 indexed txId, address indexed signer);
    event TransactionExecuted(uint256 indexed txId);
    
    error NoVotersProvided();
    error InvalidRequiredSignatures();
    error TransactionAlreadyExecuted();
    error AlreadySigned();
    error NotEnoughSignatures();
    error TransactionFailed();
    error AlreadyVoter();
    error NotVoter();
    error InvalidRequiredSignaturesCount();
    
    constructor(address[] memory _voters, uint256 _requiredSignatures) payable {
        if (_voters.length == 0) revert NoVotersProvided();
        if (_requiredSignatures == 0 || _requiredSignatures > _voters.length) revert InvalidRequiredSignatures();
        
        // Grant owner role to deployer
        _grantRole(OWNER_ROLE, msg.sender);
        
        // Grant voter role to all voters
        for (uint256 i = 0; i < _voters.length; i++) {
            _grantRole(VOTER_ROLE, _voters[i]);
        }
        
        requiredSignatures = _requiredSignatures;
    }
    
    function createTransaction(address _to, uint256 _value, bytes memory _data) 
        external 
        onlyRole(OWNER_ROLE) 
        returns (uint256) 
    {
        uint256 txId = transactionCount++;
        transactions[txId] = Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            signatureCount: 0
        });
        
        emit TransactionCreated(txId, _to, _value, _data);
        return txId;
    }
    
    function signTransaction(uint256 _txId) external onlyRole(VOTER_ROLE) {
        if (transactions[_txId].executed) revert TransactionAlreadyExecuted();
        if (signatures[_txId][msg.sender]) revert AlreadySigned();
        
        signatures[_txId][msg.sender] = true;
        transactions[_txId].signatureCount++;
        
        emit TransactionSigned(_txId, msg.sender);
    }
    
    function executeTransaction(uint256 _txId) external nonReentrant onlyRole(VOTER_ROLE) {
        Transaction storage transaction = transactions[_txId];
        if (transaction.executed) revert TransactionAlreadyExecuted();
        if (transaction.signatureCount < requiredSignatures) revert NotEnoughSignatures();
        
        transaction.executed = true;
        
        (bool success, ) = transaction.to.call{value: transaction.value}(transaction.data);
        if (!success) revert TransactionFailed();
        
        emit TransactionExecuted(_txId);
    }
    
    function addVoter(address _newVoter) external onlyRole(OWNER_ROLE) {
        if (hasRole(VOTER_ROLE, _newVoter)) revert AlreadyVoter();
        _grantRole(VOTER_ROLE, _newVoter);
    }
    
    function removeVoter(address _voter) external onlyRole(OWNER_ROLE) {
        if (!hasRole(VOTER_ROLE, _voter)) revert NotVoter();
        _revokeRole(VOTER_ROLE, _voter);
    }
    
    function updateRequiredSignatures(uint256 _newRequired) external onlyRole(OWNER_ROLE) {
        if (_newRequired == 0) revert InvalidRequiredSignaturesCount();
        requiredSignatures = _newRequired;
    }
    
    receive() external payable {}
} 