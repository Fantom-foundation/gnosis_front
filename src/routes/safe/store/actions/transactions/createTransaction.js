// @flow
import { push } from 'connected-react-router'
import type { RecordInstance } from 'immutable'
import { List } from 'immutable'
import type { GetState, Dispatch as ReduxDispatch } from 'redux'
// import semverSatisfies from 'semver/functions/satisfies'

import { makeConfirmation } from '../../models/confirmation'

import fetchTransactions from './fetchTransactions'
import updateTransaction from './updateTransaction'

import { onboardUser } from '~/components/ConnectButton'
import { getGnosisSafeInstanceAt } from '~/logic/contracts/safeContracts'
import { type NotificationsQueue, getNotificationsFromTxType, showSnackbar } from '~/logic/notifications'
import {
  CALL,
  type NotifiedTransaction,
  getApprovalTransaction,
  getExecutionTransaction,
  saveTxToHistory,
} from '~/logic/safe/transactions'
import { estimateSafeTxGas } from '~/logic/safe/transactions/gasNew'
// import { SAFE_VERSION_FOR_OFFCHAIN_SIGNATURES, tryOffchainSigning } from '~/logic/safe/transactions/offchainSigner'
// import { getCurrentSafeVersion } from '~/logic/safe/utils/safeVersion'
import { TOKEN_REDUCER_ID } from '~/logic/tokens/store/reducer/tokens'
import { ZERO_ADDRESS, sameAddress } from '~/logic/wallets/ethAddresses'
import { EMPTY_DATA } from '~/logic/wallets/ethTransactions'
import { providerSelector } from '~/logic/wallets/store/selectors'
import { SAFELIST_ADDRESS } from '~/routes/routes'
import { addCancellationTransaction } from '~/routes/safe/store/actions/transactions/addCancellationTransaction'
import { addTransaction } from '~/routes/safe/store/actions/transactions/addTransaction'
import type { TxServiceModel } from '~/routes/safe/store/actions/transactions/fetchTransactions/loadOutgoingTransactions'
import { buildTransactionFrom } from '~/routes/safe/store/actions/transactions/fetchTransactions/loadOutgoingTransactions'
import { updateCancellationTransaction } from '~/routes/safe/store/actions/transactions/updateCancellationTransaction'
import { getLastTx, getNewTxNonce, shouldExecuteTransaction } from '~/routes/safe/store/actions/utils'
import type { TransactionProps } from '~/routes/safe/store/models/transaction'
import { CANCELLATION_TRANSACTIONS_REDUCER_ID } from '~/routes/safe/store/reducer/cancellationTransactions'
import { TRANSACTIONS_REDUCER_ID } from '~/routes/safe/store/reducer/transactions'
import { type GlobalState } from '~/store'
import { getErrorMessage } from '~/test/utils/ethereumErrors'

export type CreateTransactionArgs = {
  safeAddress: string,
  to: string,
  valueInWei: string,
  txData: string,
  notifiedTransaction: $Values<NotifiedTransaction>,
  enqueueSnackbar: Function,
  closeSnackbar: Function,
  txNonce?: number,
  operation?: 0 | 1,
  navigateToTransactionsTab?: boolean,
  origin?: string | null,
}

async function mockMyTransaction(safeAddress: string, state, tx: {}) {
  const submissionDate = new Date().toISOString()
  const knownTokens = state[TOKEN_REDUCER_ID]
  const cancellationTx = sameAddress(tx.to, safeAddress) && Number(tx.value) === 0 && !tx.data
  const existentTx: TransactionProps =
    state[cancellationTx ? CANCELLATION_TRANSACTIONS_REDUCER_ID : TRANSACTIONS_REDUCER_ID]
      .get(safeAddress)
      .find(({ nonce }) => nonce === tx.nonce) || null

  const transactionStructure: TxServiceModel = {
    ...tx,
    value: tx.valueInWei,
    blockNumber: null,
    confirmations: [], // this is used to determine if a tx is pending or not. See `getTxStatus` selector
    confirmationsRequired: null,
    dataDecoded: {},
    ethGasPrice: null,
    executionDate: null,
    executor: null,
    fee: null,
    gasUsed: null,
    isExecuted: false,
    isSuccessful: null,
    origin: null,
    safeTxHash: null,
    signatures: null,
    transactionHash: null,
    ...existentTx,
    modified: submissionDate,
    submissionDate,
    safe: safeAddress,
  }

  const mockedTransaction: RecordInstance<TransactionProps> = await buildTransactionFrom(
    safeAddress,
    transactionStructure,
    knownTokens,
    null,
  )

  return { cancellationTx, existentTx, mockedTransaction }
}

const createTransaction = ({
  safeAddress,
  to,
  valueInWei,
  txData = EMPTY_DATA,
  notifiedTransaction,
  enqueueSnackbar,
  closeSnackbar,
  txNonce,
  operation = CALL,
  navigateToTransactionsTab = true,
  origin = null,
}: CreateTransactionArgs) => async (dispatch: ReduxDispatch<GlobalState>, getState: GetState<GlobalState>) => {
  const state: GlobalState = getState()

  if (navigateToTransactionsTab) {
    dispatch(push(`${SAFELIST_ADDRESS}/${safeAddress}/transactions`))
  }

  const ready = await onboardUser()
  if (!ready) return

  const { account: from /*, hardwareWallet, smartContractWallet*/ } = providerSelector(state)
  const safeInstance = await getGnosisSafeInstanceAt(safeAddress)
  const lastTx = await getLastTx(safeAddress)
  const nonce = await getNewTxNonce(txNonce, lastTx, safeInstance)
  const isExecution = await shouldExecuteTransaction(safeInstance, nonce, lastTx)
  // const safeVersion = await getCurrentSafeVersion(safeInstance)
  const safeTxGas = await estimateSafeTxGas(safeInstance, safeAddress, txData, to, valueInWei, operation)

  // https://docs.gnosis.io/safe/docs/docs5/#pre-validated-signatures
  const sigs = `0x000000000000000000000000${from.replace(
    '0x',
    '',
  )}000000000000000000000000000000000000000000000000000000000000000001`

  const notificationsQueue: NotificationsQueue = getNotificationsFromTxType(notifiedTransaction, origin)
  const beforeExecutionKey = showSnackbar(notificationsQueue.beforeExecution, enqueueSnackbar, closeSnackbar)
  let pendingExecutionKey

  let txHash
  let tx
  const txArgs = {
    safeInstance,
    to,
    valueInWei,
    data: txData,
    operation,
    nonce,
    safeTxGas,
    baseGas: 0,
    gasPrice: 0,
    gasToken: ZERO_ADDRESS,
    refundReceiver: ZERO_ADDRESS,
    sender: from,
    sigs,
  }

  try {
    // Here we're checking that safe contract version is greater or equal 1.1.1, but
    // theoretically EIP712 should also work for 1.0.0 contracts
    // TODO: revert this
    // const canTryOffchainSigning =
    //   !isExecution && !smartContractWallet && semverSatisfies(safeVersion, SAFE_VERSION_FOR_OFFCHAIN_SIGNATURES)
    // if (canTryOffchainSigning) {
    //   const signature = await tryOffchainSigning({ ...txArgs, safeAddress }, hardwareWallet)
    //
    //   if (signature) {
    //     closeSnackbar(beforeExecutionKey)
    //
    //     await saveTxToHistory({
    //       ...txArgs,
    //       signature,
    //       origin,
    //     })
    //     showSnackbar(notificationsQueue.afterExecution.moreConfirmationsNeeded, enqueueSnackbar, closeSnackbar)
    //
    //     dispatch(fetchTransactions(safeAddress))
    //     return
    //   }
    // }

    tx = isExecution ? await getExecutionTransaction(txArgs) : await getApprovalTransaction(txArgs)

    const sendParams = { from, value: 0 }

    // if not set owner management tests will fail on ganache
    if (process.env.NODE_ENV === 'test') {
      sendParams.gas = '7000000'
    }

    await tx
      .send(sendParams)
      .once('transactionHash', async (hash) => {
        txHash = hash
        closeSnackbar(beforeExecutionKey)

        pendingExecutionKey = showSnackbar(notificationsQueue.pendingExecution, enqueueSnackbar, closeSnackbar)

        try {
          // TODO: let's mock the tx
          const { cancellationTx, existentTx, mockedTransaction } = await mockMyTransaction(safeAddress, state, {
            ...txArgs,
            txHash,
          })
          if (cancellationTx) {
            if (existentTx) {
              dispatch(updateCancellationTransaction({ safeAddress, transaction: mockedTransaction }))
            } else {
              dispatch(addCancellationTransaction({ safeAddress, transaction: mockedTransaction }))
            }
          } else {
            if (existentTx) {
              dispatch(updateTransaction({ safeAddress, transaction: mockedTransaction }))
            } else {
              dispatch(addTransaction({ safeAddress, transaction: mockedTransaction }))
            }
          }

          await saveTxToHistory({ ...txArgs, txHash, origin })
          await dispatch(fetchTransactions(safeAddress))
        } catch (err) {
          console.error(err)
        }
      })
      .on('error', (error) => {
        console.error('Tx error: ', error)
      })
      .then((receipt) => {
        closeSnackbar(pendingExecutionKey)
        const safeTxHash = isExecution
          ? receipt.events.ExecutionSuccess.returnValues[0]
          : receipt.events.ApproveHash.returnValues[0]

        dispatch(
          updateTransaction({
            safeAddress,
            transaction: {
              safeTxHash,
              isExecuted: isExecution,
              isSuccessful: isExecution ? true : null,
              executionTxHash: isExecution ? receipt.transactionHash : null,
              executor: isExecution ? from : null,
              confirmations: List([
                makeConfirmation({
                  type: 'confirmation',
                  hash: receipt.transactionHash,
                  signature: sigs,
                  owner: from,
                }),
              ]),
            },
          }),
        )

        showSnackbar(
          isExecution
            ? notificationsQueue.afterExecution.noMoreConfirmationsNeeded
            : notificationsQueue.afterExecution.moreConfirmationsNeeded,
          enqueueSnackbar,
          closeSnackbar,
        )

        dispatch(fetchTransactions(safeAddress))

        return receipt.transactionHash
      })
  } catch (err) {
    console.error(err)
    closeSnackbar(beforeExecutionKey)
    closeSnackbar(pendingExecutionKey)
    showSnackbar(notificationsQueue.afterExecutionError, enqueueSnackbar, closeSnackbar)

    const executeDataUsedSignatures = safeInstance.contract.methods
      .execTransaction(to, valueInWei, txData, operation, 0, 0, 0, ZERO_ADDRESS, ZERO_ADDRESS, sigs)
      .encodeABI()
    const errMsg = await getErrorMessage(safeInstance.address, 0, executeDataUsedSignatures, from)
    console.error(`Error creating the TX: ${errMsg}`)
  }

  return txHash
}

export default createTransaction
