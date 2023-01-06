pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "Interfaces/IBancor.sol";

/**
 * @title Picaso Token
 * @author Emil Bob
 * @notice Contract that allows creating and burning a NFT token.
 */

contract PicasoToken is ERC721 {
    using SafeERC20 for IERC20;

    uint256 internal tokenId;
    mapping(uint256 => PicToken) positions;
    struct PicToken {
        address tokenAddress;
        uint256 tokenAmount;
    }

    IContractRegistry contractRegistry;
    bytes32 bancorNetworkName = bytes32("BancorNetwork");

    function getBancorNetworkContract() public returns (IBancorNetwork) {
        return IBancorNetwork(contractRegistry.addressOf(bancorNetworkName));
    }

    /**
     * @notice Constructor declares a token name and symbol.
     *
     * @dev Constructor takes an address of proper test network.
     *
     * @param _contractRegistryAddress represents a test a network, it can be a mainnet net or testnet.
     */

    constructor(address _contractRegistryAddress)
        ERC721("Picaso Token", "PCT")
    {
        contractRegistry = IContractRegistry(_contractRegistryAddress);
    }

    /**
     * @notice This function is used for creatnig an NFT by depositing certain
     * amount of desired ERC20 token on contract.
     *
     * @param _tokenAddress represents an address of desired ERC20 token to deposit.
     *
     * @param _tokenAmount represents an amount of desired ERC20 token to deposit.
     *
     * Function will revert if ERC20 token doesn't give approval for the contract to
     * withdraw the money, and if  the amount that is aproved by token isn't enough.
     */

    function createNft(address _tokenAddress, uint256 _tokenAmount)
        external
        payable
    {
        IERC20(_tokenAddress).safeTransferFrom(
            msg.sender,
            address(this),
            _tokenAmount
        );

        positions[tokenId].tokenAddress = _tokenAddress;
        positions[tokenId].tokenAmount = _tokenAmount;

        _mint(msg.sender, tokenId++);
    }

    /**
     * @notice This function is used for burning the NFT and withdraving desired
     * amount of desired ERC20 token that is less or equal than deposited ERC20 token on contract.
     *
     * @param _tokenId Is a number dedicated to the NFT token, an unique identifier,
     * used for selecting ceratin NFT.
     *
     * @param _tokenAddress represents an addrress of desired ERC20 token to withdraw.
     *
     * @param _expectedAmount represents an amount that user expects to withdraw.
     *
     * @param _returnAmount represents the amount that can be withdrawn.
     *
     * Function will revert for non-existing NFT and if the expected amount is greater
     * than minimal possible return. The Swap beetween ERC20 tokens uses bancor protocol.
     */

    function liquidateNft(
        uint256 _tokenId,
        address _tokenAddress,
        uint256 _expectedAmount
    ) external returns (uint256 _returnAmount) {
        require(_exists(_tokenId), "Expected NFT doesn't exists");

        uint256 nftAmount = positions[_tokenId].tokenAmount;
        address nftAddress = positions[_tokenId].tokenAddress;

        IBancorNetwork bancorNetwork = IBancorNetwork(
            contractRegistry.addressOf(bancorNetworkName)
        );

        address[] memory path = bancorNetwork.conversionPath(
            nftAddress,
            _tokenAddress
        );

        uint256 minReturn = bancorNetwork.rateByPath(path, nftAmount);

        require(minReturn >= _expectedAmount, "Expentemed amount to high");

        IERC20(nftAddress).safeApprove(address(bancorNetwork), nftAmount);

        _returnAmount = bancorNetwork.convertByPath(
            path,
            nftAmount,
            minReturn,
            address(0),
            address(0),
            0
        );

        _burn(_tokenId);
    }

    /**
     * @notice This function is used for getting an address of.
     * certain NFT token by providing an unique identifier,
     *
     * @param _tokenId stands for unique identifier of certain NFT token.
     *
     * Function will revert for non-existing NFT
     */

    function getTokenAddressForToken(uint256 _tokenId)
        external
        view
        returns (address)
    {
        require(_exists(_tokenId), "Expected NFT doesn't exists");

        return positions[_tokenId].tokenAddress;
    }

    /**
     * @notice This function is used for getting an amount of.
     * certain NFT token by providing a unique identifier,
     *
     * @param _tokenId stands for unique identifier of certain NFT token.
     *
     * Function will revert for non-existing NFT
     */

    function getTokenAmountForToken(uint256 _tokenId)
        external
        view
        returns (uint256)
    {
        require(_exists(_tokenId), "Expected NFT doesn't exists");
        return positions[_tokenId].tokenAmount;
    }

    /**
     * @notice This function is checking if the certain NFT exists.
     *
     * @param _tokenId stands for unique identifier of certain NFT token.
     */

    function exists(uint256 _tokenId) external view returns (bool) {
        return _exists(_tokenId);
    }
}
