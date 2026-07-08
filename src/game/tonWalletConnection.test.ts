import { describe, expect, test } from 'vitest'

import { assessTonWalletConnectionPolicy } from './tonWalletConnection'

describe('TON wallet connection policy', () => {
  test('keeps wallet connection optional, disabled, and non-custodial by default', () => {
    const assessment = assessTonWalletConnectionPolicy()

    expect(assessment).toEqual({
      enabled: false,
      walletConnectionRequiredToPlay: false,
      walletStorageEnabled: false,
      depositsEnabled: false,
      withdrawalsEnabled: false,
      highFrequencyGameplayOnChain: false,
      privateKeyCustody: 'forbidden',
      rail: 'ton',
      sourceOfTruth: 'reality_server_ledger',
      realityAccountId: null,
      telegramRealityAccountId: null,
      walletAddress: null,
      tonConnectProofPresent: false,
      readyForManualReview: false,
      canConnect: false,
      reviewDraft: null,
      blockers: [
        'wallet_connection_disabled',
        'wallet_storage_disabled',
        'server_authority_required',
        'telegram_identity_required',
        'ton_connect_review_required',
        'wallet_address_required',
        'ton_connect_proof_required',
      ],
    })
  })

  test('models a ready manual review request without enabling connection or storing proof material', () => {
    const assessment = assessTonWalletConnectionPolicy({
      realityAccountId: ' telegram:42424242 ',
      telegramRealityAccountId: 'telegram:42424242',
      telegramIdentityVerified: true,
      serverAuthorityReady: true,
      tonConnectReviewed: true,
      walletAddress: ' EQD_wallet_address ',
      tonConnectProof: 'signed-ton-connect-proof',
    })

    expect(assessment).toMatchObject({
      enabled: false,
      walletConnectionRequiredToPlay: false,
      walletStorageEnabled: false,
      canConnect: false,
      readyForManualReview: true,
      realityAccountId: 'telegram:42424242',
      telegramRealityAccountId: 'telegram:42424242',
      walletAddress: 'EQD_wallet_address',
      tonConnectProofPresent: true,
      blockers: ['wallet_connection_disabled', 'wallet_storage_disabled'],
    })
    expect(assessment.reviewDraft).toEqual({
      kind: 'ton_wallet_connection_review',
      executionEnabled: false,
      walletStorageEnabled: false,
      rail: 'ton',
      sourceOfTruth: 'reality_server_ledger',
      realityAccountId: 'telegram:42424242',
      telegramRealityAccountId: 'telegram:42424242',
      walletAddress: 'EQD_wallet_address',
      tonConnectProofPresent: true,
      privateKeyCustody: 'forbidden',
      blockers: ['wallet_connection_disabled', 'wallet_storage_disabled'],
    })
    expect(JSON.stringify(assessment.reviewDraft)).not.toContain('signed-ton-connect-proof')
  })

  test('blocks wallet review when Telegram identity does not match the Reality account', () => {
    const assessment = assessTonWalletConnectionPolicy({
      realityAccountId: 'telegram:42424242',
      telegramRealityAccountId: 'telegram:777',
      telegramIdentityVerified: true,
      serverAuthorityReady: true,
      tonConnectReviewed: true,
      walletAddress: 'EQD_wallet_address',
      tonConnectProof: 'proof',
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.blockers).toEqual([
      'wallet_connection_disabled',
      'wallet_storage_disabled',
      'account_mismatch',
    ])
  })

  test('requires both a wallet address and TON Connect proof for manual review', () => {
    const assessment = assessTonWalletConnectionPolicy({
      realityAccountId: 'telegram:42424242',
      telegramRealityAccountId: 'telegram:42424242',
      telegramIdentityVerified: true,
      serverAuthorityReady: true,
      tonConnectReviewed: true,
      walletAddress: ' ',
      tonConnectProof: '',
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.walletAddress).toBeNull()
    expect(assessment.tonConnectProofPresent).toBe(false)
    expect(assessment.blockers).toEqual([
      'wallet_connection_disabled',
      'wallet_storage_disabled',
      'wallet_address_required',
      'ton_connect_proof_required',
    ])
  })

  test('rejects private key or seed phrase custody attempts even when other checks pass', () => {
    const assessment = assessTonWalletConnectionPolicy({
      realityAccountId: 'telegram:42424242',
      telegramRealityAccountId: 'telegram:42424242',
      telegramIdentityVerified: true,
      serverAuthorityReady: true,
      tonConnectReviewed: true,
      walletAddress: 'EQD_wallet_address',
      tonConnectProof: 'proof',
      privateKeyMaterialProvided: true,
      seedPhraseMaterialProvided: true,
    })

    expect(assessment.readyForManualReview).toBe(false)
    expect(assessment.reviewDraft).toBeNull()
    expect(assessment.privateKeyCustody).toBe('forbidden')
    expect(assessment.blockers).toEqual([
      'wallet_connection_disabled',
      'wallet_storage_disabled',
      'private_key_custody_forbidden',
    ])
  })
})
