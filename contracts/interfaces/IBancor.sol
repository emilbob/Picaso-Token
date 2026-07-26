// SPDX-License-Identifier: ISC
pragma solidity ^0.8.28;

/**
 * @title IContractRegistry
 * @author Bancor (third-party interface, reproduced)
 * @notice Minimal view of Bancor's contract registry — resolves named contracts.
 */
interface IContractRegistry {
    /**
     * @notice Resolves a registered contract name to its current address.
     * @param contractName The registry key, e.g. `bytes32("BancorNetwork")`.
     * @return The address currently registered under that name.
     */
    function addressOf(bytes32 contractName) external view returns (address);
}

/**
 * @title IBancorNetwork
 * @author Bancor (third-party interface, reproduced)
 * @notice Minimal view of the Bancor network used for quoting and swapping.
 */
interface IBancorNetwork {
    /**
     * @notice Executes a conversion along a path.
     * @param _path The conversion path, source token first and target token last.
     * @param _amount The amount of the source token to convert.
     * @param _minReturn The minimum acceptable output; the swap reverts below it.
     * @param _beneficiary Recipient of the conversion result. Bancor treats
     * `address(0)` as "send to msg.sender" — which, called from a contract,
     * means the calling contract itself. Always pass an explicit recipient.
     * @param _affiliateAccount Affiliate fee recipient, or `address(0)` for none.
     * @param _affiliateFee Affiliate fee in PPM, or zero for none.
     * @return The amount of the target token sent to `_beneficiary`.
     */
    function convertByPath(
        address[] memory _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) external payable returns (uint256);

    /**
     * @notice Quotes a conversion without executing it.
     * @param _path The conversion path, source token first and target token last.
     * @param _amount The amount of the source token to convert.
     * @return The expected amount of the target token at current reserves.
     */
    function rateByPath(address[] memory _path, uint256 _amount)
        external
        view
        returns (uint256);

    /**
     * @notice Computes the conversion path between two tokens.
     * @param _sourceToken The token being sold.
     * @param _targetToken The token being bought.
     * @return The path to pass to `rateByPath` and `convertByPath`.
     */
    function conversionPath(address _sourceToken, address _targetToken)
        external
        view
        returns (address[] memory);
}
