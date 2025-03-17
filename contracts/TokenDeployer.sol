// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "./MultiSigWallet.sol";

contract WrappedToken is ERC20, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 public constant BURNER_ROLE = keccak256("BURNER_ROLE");
    
    error UnauthorizedMint();
    error UnauthorizedBurn();
    
    constructor(string memory name) ERC20(name, name) {
        // Grant roles to msg.sender (TokenDeployer)
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
        _grantRole(BURNER_ROLE, msg.sender);
    }
    
    function mint(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }
    
    function burn(address from, uint256 amount) external onlyRole(BURNER_ROLE) {
        _burn(from, amount);
    }
}

contract TokenDeployer is Ownable {
    MultiSigWallet public immutable multisig;
    
    // Mapping from token name to token address
    mapping(string => address) public tokenAddresses;
    // Mapping from token address to token name
    mapping(address => string) public tokenNames;
    
    event TokenDeployed(string name, address tokenAddress);
    event TokensMinted(address indexed token, address indexed to, uint256 amount);
    event TokensBurned(address indexed token, address indexed from, uint256 amount);
    
    error TokenNotFound();
    error InvalidTokenAddress();
    
    constructor(address payable _multisig) Ownable(_multisig) {
        multisig = MultiSigWallet(_multisig);
    }
    
    function deployToken(string memory name) external returns (address) {
        require(bytes(name).length > 0, "Name cannot be empty");
        require(tokenAddresses[name] == address(0), "Token name already exists");
        
        // Create new wrapped token
        WrappedToken newToken = new WrappedToken(name);
        address tokenAddress = address(newToken);
        
        // Grant roles to multisig
        WrappedToken(tokenAddress).grantRole(WrappedToken(tokenAddress).MINTER_ROLE(), address(multisig));
        WrappedToken(tokenAddress).grantRole(WrappedToken(tokenAddress).BURNER_ROLE(), address(multisig));
        
        // Store mappings
        tokenAddresses[name] = tokenAddress;
        tokenNames[tokenAddress] = name;
        
        emit TokenDeployed(name, tokenAddress);
        return tokenAddress;
    }
    
    function mintTokens(string memory tokenName, address to, uint256 amount) external {
        if (msg.sender != address(multisig)) revert("Only multisig can call");
        
        address tokenAddress = tokenAddresses[tokenName];
        if (tokenAddress == address(0)) revert TokenNotFound();
        
        WrappedToken(tokenAddress).mint(to, amount);
        emit TokensMinted(tokenAddress, to, amount);
    }
    
    function burnTokens(string memory tokenName, address from, uint256 amount) external {
        if (msg.sender != address(multisig)) revert("Only multisig can call");
        
        address tokenAddress = tokenAddresses[tokenName];
        if (tokenAddress == address(0)) revert TokenNotFound();
        
        WrappedToken(tokenAddress).burn(from, amount);
        emit TokensBurned(tokenAddress, from, amount);
    }
    
    function getTokenAddress(string memory name) external view returns (address) {
        return tokenAddresses[name];
    }
    
    function getTokenName(address tokenAddress) external view returns (string memory) {
        return tokenNames[tokenAddress];
    }
} 