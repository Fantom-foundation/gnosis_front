import { AbiItem } from 'web3-utils'
import GnosisSafeSol from '@gnosis.pm/safe-contracts/build/contracts/GnosisSafe.json'
import ProxyFactorySol from '@gnosis.pm/safe-contracts/build/contracts/GnosisSafeProxyFactory.json'
import Web3 from 'web3'

import { ETHEREUM_NETWORK } from 'src/config/networks/network.d'
import { ZERO_ADDRESS } from 'src/logic/wallets/ethAddresses'
import { calculateGasOf, calculateGasPrice } from 'src/logic/wallets/ethTransactions'
import { getWeb3, getNetworkIdFrom } from 'src/logic/wallets/getWeb3'
import { GnosisSafe } from 'src/types/contracts/GnosisSafe.d'
import { GnosisSafeProxyFactory } from 'src/types/contracts/GnosisSafeProxyFactory.d'
import { AllowanceModule } from 'src/types/contracts/AllowanceModule.d'
import { getSafeInfo, SafeInfo } from 'src/logic/safe/utils/safeInformation'
import { SPENDING_LIMIT_MODULE_ADDRESS } from 'src/utils/constants'

import SpendingLimitModule from './artifacts/AllowanceModule.json'

//for opera net
import { GNOSIS_TESTNET_ADDRESSES } from '../../web3.constants/addresses'
import gnosis_safe_abi from '../../web3.constants/gnosis_safe'
import proxy_factory_abi from '../../web3.constants/proxy_factory'
import safe_master_copy_address_v_10 from '../../web3.constants/safe_master_copy_address_v_10'

export const SENTINEL_ADDRESS = GNOSIS_TESTNET_ADDRESSES.SENTINEL_ADDRESS
export const MULTI_SEND_ADDRESS = GNOSIS_TESTNET_ADDRESSES.MULTISEND
export const SAFE_MASTER_COPY_ADDRESS = GNOSIS_TESTNET_ADDRESSES.MASTERCOPY
export const DEFAULT_FALLBACK_HANDLER_ADDRESS = GNOSIS_TESTNET_ADDRESSES.DEFAULTCALLBACKHANDLER
export const SAFE_MASTER_COPY_ADDRESS_V10 = GNOSIS_TESTNET_ADDRESSES.SAFE_MASTER_COPY_ADDRESS_V10

const Gnosis_Safe_ABI = gnosis_safe_abi
const Proxy_Factory_ABI = proxy_factory_abi
const Safe_Master_Copy_Address_V_10_ABI = safe_master_copy_address_v_10

let proxyFactoryMaster: GnosisSafeProxyFactory
let safeMaster: GnosisSafe

/**
 * Creates a Contract instance of the GnosisSafe contract
 * @param {Web3} web3
 * @param {ETHEREUM_NETWORK} networkId
 */
export const getGnosisSafeContract = (web3: Web3, networkId: ETHEREUM_NETWORK) => {
  const networks = GnosisSafeSol.networks
  // TODO: this may not be the most scalable approach,
  //  but up until v1.2.0 the address is the same for all the networks.
  //  So, if we can't find the network in the Contract artifact, we fallback to MAINNET.

  // const contractAddress = networks[networkId]?.address ?? networks[ETHEREUM_NETWORK.MAINNET].address
  // return (new web3.eth.Contract(GnosisSafeSol.abi as AbiItem[], contractAddress) as unknown) as GnosisSafe

  //adapt to Opera testnet
  const contractAddress = GNOSIS_TESTNET_ADDRESSES.GNOSIS_SAFE
  return (new web3.eth.Contract(Gnosis_Safe_ABI as AbiItem[], contractAddress) as unknown) as GnosisSafe
}

/**
 * Creates a Contract instance of the GnosisSafeProxyFactory contract
 * @param {Web3} web3
 * @param {ETHEREUM_NETWORK} networkId
 */
const getProxyFactoryContract = (web3: Web3, networkId: ETHEREUM_NETWORK): GnosisSafeProxyFactory => {
  // TODO: this may not be the most scalable approach,
  //  but up until v1.2.0 the address is the same for all the networks.
  //  So, if we can't find the network in the Contract artifact, we fallback to MAINNET.

  //original gnosis

  // const networks = ProxyFactorySol.networks
  // const contractAddress = networks[networkId]?.address ?? networks[ETHEREUM_NETWORK.MAINNET].address
  // return (new web3.eth.Contract(ProxyFactorySol.abi as AbiItem[], contractAddress) as unknown) as GnosisSafeProxyFactory

  //adapt to Opera testnet
  const contractAddress = GNOSIS_TESTNET_ADDRESSES.PROXY_FACTORY_CONTRACT
  return (new web3.eth.Contract(Proxy_Factory_ABI as AbiItem[], contractAddress) as unknown) as GnosisSafeProxyFactory
}

/**
 * Creates a Contract instance of the GnosisSafeProxyFactory contract
 */
export const getSpendingLimitContract = () => {
  const web3 = getWeb3()

  //original for gnosis
  // return (new web3.eth.Contract(
  //   SpendingLimitModule.abi as AbiItem[],
  //   SPENDING_LIMIT_MODULE_ADDRESS,
  // ) as unknown) as AllowanceModule

  return (new web3.eth.Contract(
    SpendingLimitModule.abi as AbiItem[],
    SPENDING_LIMIT_MODULE_ADDRESS,
  ) as unknown) as AllowanceModule
}

export const getMasterCopyAddressFromProxyAddress = async (proxyAddress: string): Promise<string | undefined> => {
  const res = await getSafeInfo(proxyAddress)
  const masterCopyAddress = (res as SafeInfo)?.masterCopy
  if (!masterCopyAddress) {
    console.error(`There was not possible to get masterCopy address from proxy ${proxyAddress}.`)
    return
  }
  return masterCopyAddress
}

export const instantiateSafeContracts = async () => {
  const web3 = getWeb3()
  const networkId = await getNetworkIdFrom(web3)

  // Create ProxyFactory Master Copy
  proxyFactoryMaster = getProxyFactoryContract(web3, networkId)

  // Create Safe Master copy
  safeMaster = getGnosisSafeContract(web3, networkId)
}

export const getSafeMasterContract = async () => {
  await instantiateSafeContracts()
  return safeMaster
}

export const getSafeDeploymentTransaction = (
  safeAccounts: string[],
  numConfirmations: number,
  safeCreationSalt: number,
) => {
  const gnosisSafeData = safeMaster.methods
    .setup(
      safeAccounts,
      numConfirmations,
      ZERO_ADDRESS,
      '0x',
      DEFAULT_FALLBACK_HANDLER_ADDRESS,
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    )
    .encodeABI()
  console.log('proxy factory master methods ')
  console.log(
    safeAccounts,
    numConfirmations,
    ZERO_ADDRESS,
    '0x',
    DEFAULT_FALLBACK_HANDLER_ADDRESS,
    ZERO_ADDRESS,
    0,
    ZERO_ADDRESS,
  )
  return proxyFactoryMaster.methods.createProxyWithNonce(safeMaster.options.address, gnosisSafeData, safeCreationSalt)
}

export const estimateGasForDeployingSafe = async (
  safeAccounts: string[],
  numConfirmations: number,
  userAccount: string,
  safeCreationSalt: number,
) => {
  const gnosisSafeData = await safeMaster.methods
    .setup(
      safeAccounts,
      numConfirmations,
      ZERO_ADDRESS,
      '0x',
      DEFAULT_FALLBACK_HANDLER_ADDRESS,
      ZERO_ADDRESS,
      0,
      ZERO_ADDRESS,
    )
    .encodeABI()
  const proxyFactoryData = proxyFactoryMaster.methods
    .createProxyWithNonce(safeMaster.options.address, gnosisSafeData, safeCreationSalt)
    .encodeABI()
  const gas = await calculateGasOf({
    data: proxyFactoryData,
    from: userAccount,
    to: proxyFactoryMaster.options.address,
  })
  const gasPrice = await calculateGasPrice()

  console.log('gasPrice is ', gasPrice)

  return gas * parseInt(gasPrice, 10)
}

export const getGnosisSafeInstanceAt = (safeAddress: string): GnosisSafe => {
  const web3 = getWeb3()
  return (new web3.eth.Contract(Gnosis_Safe_ABI as AbiItem[], safeAddress) as unknown) as GnosisSafe
}
