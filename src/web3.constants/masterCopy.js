const masterCopy_abi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: false,
        internalType: 'address',
        name: 'masterCopy',
        type: 'address',
      },
    ],
    name: 'ChangedMasterCopy',
    type: 'event',
  },
  {
    constant: false,
    inputs: [
      {
        internalType: 'address',
        name: '_masterCopy',
        type: 'address',
      },
    ],
    name: 'changeMasterCopy',
    outputs: [],
    payable: false,
    stateMutability: 'nonpayable',
    type: 'function',
  },
]

export default masterCopy_abi
