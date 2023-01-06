pragma solidity ^0.8.0;

interface IContractRegistry {
    function addressOf(bytes32 contractName) external returns (address);
}

interface IBancorNetwork {
    function convertByPath(
        address[] memory _path,
        uint256 _amount,
        uint256 _minReturn,
        address _beneficiary,
        address _affiliateAccount,
        uint256 _affiliateFee
    ) external payable returns (uint256);

    function rateByPath(address[] memory _path, uint256 _amount)
        external
        view
        returns (uint256);

    function conversionPath(address _sourceToken, address _targetToken)
        external
        view
        returns (address[] memory);
}
