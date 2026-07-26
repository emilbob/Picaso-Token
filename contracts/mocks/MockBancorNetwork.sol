// SPDX-License-Identifier: ISC
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IBancorNetwork, IContractRegistry} from "../interfaces/IBancor.sol";

/**
 * @notice Deterministic stand-in for Bancor's network contract.
 * @dev Prices a swap as `amount * rateNumerator / rateDenominator` and pays out
 * of its own balance of the target token, which tests pre-fund. Faithful on the
 * points that matter to PicasoToken: it pulls the source token via the approval
 * it was granted, honours `_minReturn`, and pays `_beneficiary` (treating
 * `address(0)` as `msg.sender`, exactly as Bancor does — which is what made the
 * original contract strand its proceeds).
 */
contract MockBancorNetwork is IBancorNetwork {
    using SafeERC20 for IERC20;

    uint256 public rateNumerator = 1;
    uint256 public rateDenominator = 1;

    /// @notice Set to true to simulate the quote moving against the caller.
    bool public failNextConversion;

    function setRate(uint256 numerator, uint256 denominator) external {
        rateNumerator = numerator;
        rateDenominator = denominator;
    }

    function setFailNextConversion(bool value) external {
        failNextConversion = value;
    }

    function conversionPath(address _sourceToken, address _targetToken)
        external
        pure
        returns (address[] memory path)
    {
        path = new address[](2);
        path[0] = _sourceToken;
        path[1] = _targetToken;
    }

    function rateByPath(address[] memory, uint256 _amount) public view returns (uint256) {
        return (_amount * rateNumerator) / rateDenominator;
    }

    function convertByPath(
        address[] memory _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address,
        uint256
    ) external payable returns (uint256) {
        require(!failNextConversion, "MockBancor: conversion failed");

        uint256 out = rateByPath(_path, _amount);
        require(out >= _minReturn, "MockBancor: return too low");

        address recipient = _beneficiary == address(0) ? msg.sender : _beneficiary;

        IERC20(_path[0]).safeTransferFrom(msg.sender, address(this), _amount);
        IERC20(_path[_path.length - 1]).safeTransfer(recipient, out);

        return out;
    }
}

/// @notice Registry stand-in that resolves any name to a single configured address.
contract MockContractRegistry is IContractRegistry {
    mapping(bytes32 => address) private addresses;

    function setAddress(bytes32 contractName, address target) external {
        addresses[contractName] = target;
    }

    function addressOf(bytes32 contractName) external view returns (address) {
        return addresses[contractName];
    }
}
