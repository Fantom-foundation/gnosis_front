import EtherLogo from 'src/config/assets/token_eth.svg'
import { EnvironmentSettings, ETHEREUM_NETWORK, FEATURES, NetworkConfig, WALLETS } from 'src/config/networks/network.d'

const baseConfig: EnvironmentSettings = {
  clientGatewayUrl: 'https://safe-client.rinkeby.staging.gnosisdev.com/v1',
  // txServiceUrl: 'https://safe-transaction.staging.gnosisdev.com/api/v1',
  txServiceUrl: 'http://54.174.183.104:4012/safetnx/api/v1',
  safeAppsUrl: 'https://safe-apps.dev.gnosisdev.com',
  gasPrice: 1e9,
  rpcServiceUrl: 'https://xapi.testnet.fantom.network/lachesis',
  networkExplorerName: 'FTMTestScan',
  networkExplorerUrl: 'https://explorer.testnet.fantom.network',
  networkExplorerApiUrl: 'https://api-rinkeby.etherscan.io/api',
}

const rinkeby: NetworkConfig = {
  environment: {
    dev: {
      ...baseConfig,
    },
    staging: {
      ...baseConfig,
      safeAppsUrl: 'https://safe-apps.staging.gnosisdev.com',
    },
    production: {
      ...baseConfig,
      clientGatewayUrl: 'https://safe-client.rinkeby.gnosis.io/v1',
      // txServiceUrl: 'https://safe-transaction.rinkeby.gnosis.io/api/v1',
      txServiceUrl: 'http://54.174.183.104:4012/safetnx/api/v1',
      safeAppsUrl: 'https://apps.gnosis-safe.io',
    },
  },
  network: {
    id: ETHEREUM_NETWORK.RINKEBY,
    backgroundColor: '#E8673C',
    textColor: '#ffffff',
    label: 'Opera Testnet',
    isTestNet: true,
    nativeCoin: {
      address: '0x000',
      name: 'FTM',
      symbol: 'FTM',
      decimals: 18,
      logoUri: EtherLogo,
    },
  },
  disabledWallets: [
    WALLETS.TREZOR,
    WALLETS.LEDGER,
    WALLETS.COINBASE,
    WALLETS.FORTMATIC,
    WALLETS.OPERA,
    WALLETS.OPERA_TOUCH,
    WALLETS.TORUS,
    WALLETS.TRUST,
    WALLETS.WALLET_CONNECT,
    WALLETS.WALLET_LINK,
    WALLETS.AUTHEREUM,
    WALLETS.LATTICE,
  ],
  disabledFeatures: [FEATURES.DOMAIN_LOOKUP],
}

export default rinkeby
