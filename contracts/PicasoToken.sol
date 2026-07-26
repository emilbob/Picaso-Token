// SPDX-License-Identifier: ISC
pragma solidity ^0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IBancorNetwork, IContractRegistry} from "./interfaces/IBancor.sol";

/**
 * @title Picaso Token
 * @author Emil Bob
 * @notice An ERC721 position backed by an ERC20 deposit. Depositing an ERC20
 * mints an NFT recording that position; burning the NFT swaps the deposit
 * through Bancor and returns the proceeds to the holder.
 * @dev Unaudited demonstration code. The reserve accounting is only as sound
 * as the Bancor integration it delegates pricing to.
 */
contract PicasoToken is ERC721, ReentrancyGuard {
    using SafeERC20 for IERC20;

    /// @notice The ERC20 deposit backing a given token id.
    struct PicToken {
        address tokenAddress;
        uint256 tokenAmount;
    }

    bytes32 private constant BANCOR_NETWORK_NAME = bytes32("BancorNetwork");

    IContractRegistry private immutable CONTRACT_REGISTRY;

    uint256 private nextTokenId;

    mapping(uint256 tokenId => PicToken position) private positions;

    /**
     * @notice Emitted when a deposit mints a new position.
     * @param tokenId The id of the minted position.
     * @param owner The account that deposited and received the NFT.
     * @param tokenAddress The deposited ERC20.
     * @param tokenAmount The amount actually received by this contract.
     */
    event NftCreated(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed tokenAddress,
        uint256 tokenAmount
    );

    /**
     * @notice Emitted when a position is burned and its deposit swapped out.
     * @param tokenId The id of the burned position.
     * @param owner The account that liquidated and received the proceeds.
     * @param targetToken The ERC20 the deposit was swapped into.
     * @param returnAmount The amount of `targetToken` sent to `owner`.
     */
    event NftLiquidated(
        uint256 indexed tokenId,
        address indexed owner,
        address indexed targetToken,
        uint256 returnAmount
    );

    error ZeroAddress();
    error ZeroAmount();
    error NotTokenOwner(uint256 tokenId, address caller);
    error InsufficientReturn(uint256 available, uint256 expected);

    /**
     * @notice Records the Bancor contract registry this instance prices against.
     * @param _contractRegistryAddress Bancor's `IContractRegistry` on the target network.
     */
    constructor(address _contractRegistryAddress) ERC721("Picaso Token", "PCT") {
        if (_contractRegistryAddress == address(0)) revert ZeroAddress();
        CONTRACT_REGISTRY = IContractRegistry(_contractRegistryAddress);
    }

    /**
     * @notice Deposits an ERC20 and mints an NFT representing that position.
     * @dev Requires the caller to have approved this contract for `_tokenAmount`
     * of `_tokenAddress` beforehand.
     * @param _tokenAddress The ERC20 to deposit.
     * @param _tokenAmount The amount to deposit.
     * @return tokenId The id of the freshly minted position.
     */
    function createNft(address _tokenAddress, uint256 _tokenAmount)
        external
        nonReentrant
        returns (uint256 tokenId)
    {
        if (_tokenAddress == address(0)) revert ZeroAddress();
        if (_tokenAmount == 0) revert ZeroAmount();

        // Measure what actually arrived rather than trusting `_tokenAmount`, so
        // fee-on-transfer tokens cannot mint a position claiming more collateral
        // than the contract received.
        uint256 balanceBefore = IERC20(_tokenAddress).balanceOf(address(this));
        IERC20(_tokenAddress).safeTransferFrom(msg.sender, address(this), _tokenAmount);
        uint256 received = IERC20(_tokenAddress).balanceOf(address(this)) - balanceBefore;
        if (received == 0) revert ZeroAmount();

        tokenId = nextTokenId++;
        positions[tokenId] = PicToken({tokenAddress: _tokenAddress, tokenAmount: received});

        _safeMint(msg.sender, tokenId);

        emit NftCreated(tokenId, msg.sender, _tokenAddress, received);
    }

    /**
     * @notice Burns a position and swaps its deposit for `_targetToken` via Bancor,
     * sending the proceeds to the caller.
     * @dev Only the position's owner may liquidate it. `_minReturn` is the caller's
     * slippage floor and is passed straight to Bancor — the quote is used only to
     * reject the swap early, never to replace the caller's floor.
     * @param _tokenId The position to liquidate.
     * @param _targetToken The ERC20 to receive.
     * @param _minReturn The minimum acceptable amount of `_targetToken`.
     * @return returnAmount The amount of `_targetToken` sent to the caller.
     */
    function liquidateNft(uint256 _tokenId, address _targetToken, uint256 _minReturn)
        external
        nonReentrant
        returns (uint256 returnAmount)
    {
        address owner = _requireOwned(_tokenId);
        if (owner != msg.sender) revert NotTokenOwner(_tokenId, msg.sender);
        if (_targetToken == address(0)) revert ZeroAddress();

        PicToken memory position = positions[_tokenId];

        IBancorNetwork bancorNetwork =
            IBancorNetwork(CONTRACT_REGISTRY.addressOf(BANCOR_NETWORK_NAME));

        address[] memory path = bancorNetwork.conversionPath(position.tokenAddress, _targetToken);

        uint256 quote = bancorNetwork.rateByPath(path, position.tokenAmount);
        if (quote < _minReturn) revert InsufficientReturn(quote, _minReturn);

        // Burn and clear before the external call: the position must not survive
        // a reentrant path, and the state is no longer needed for the swap.
        delete positions[_tokenId];
        _burn(_tokenId);

        IERC20(position.tokenAddress).forceApprove(address(bancorNetwork), position.tokenAmount);

        returnAmount = bancorNetwork.convertByPath(
            path,
            position.tokenAmount,
            _minReturn,
            msg.sender, // beneficiary — proceeds go to the holder, not this contract
            address(0),
            0
        );

        emit NftLiquidated(_tokenId, msg.sender, _targetToken, returnAmount);
    }

    /**
     * @notice The ERC20 backing a position. Reverts if the position does not exist.
     * @param _tokenId The position to look up.
     * @return The deposited ERC20's address.
     */
    function getTokenAddressForToken(uint256 _tokenId) external view returns (address) {
        _requireOwned(_tokenId);
        return positions[_tokenId].tokenAddress;
    }

    /**
     * @notice The deposited amount backing a position. Reverts if it does not exist.
     * @param _tokenId The position to look up.
     * @return The amount of the deposited ERC20 held against this position.
     */
    function getTokenAmountForToken(uint256 _tokenId) external view returns (uint256) {
        _requireOwned(_tokenId);
        return positions[_tokenId].tokenAmount;
    }

    /**
     * @notice Whether a position currently exists.
     * @param _tokenId The position to check.
     * @return True while the NFT is minted and unburned.
     */
    function exists(uint256 _tokenId) external view returns (bool) {
        return _ownerOf(_tokenId) != address(0);
    }

    /// @notice The Bancor network contract this instance currently resolves to.
    function getBancorNetworkContract() external view returns (IBancorNetwork) {
        return IBancorNetwork(CONTRACT_REGISTRY.addressOf(BANCOR_NETWORK_NAME));
    }
}
