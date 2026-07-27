// SPDX-License-Identifier: ISC
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice ERC20 that burns a fixed basis-point fee on every transfer, for tests only.
contract MockFeeOnTransferERC20 is ERC20 {
    uint256 public immutable FEE_BPS;

    constructor(uint256 feeBps_) ERC20("Fee Token", "FEE") {
        FEE_BPS = feeBps_;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from == address(0) || to == address(0)) {
            super._update(from, to, value);
            return;
        }
        uint256 fee = (value * FEE_BPS) / 10_000;
        super._update(from, to, value - fee);
        super._update(from, address(0), fee);
    }
}
