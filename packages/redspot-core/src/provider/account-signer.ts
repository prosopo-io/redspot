import type { Signer as PolkadotSigner } from '@polkadot/api/types';
import { SignerResult } from '@polkadot/api/types';
import Keyring from '@polkadot/keyring';
import type { KeyringPair } from '@polkadot/keyring/types';
import type { Registry } from '@polkadot/types/types';
import { SignerPayloadJSON, SignerPayloadRaw } from '@polkadot/types/types';
import { u8aToHex } from '@polkadot/util';
import { RedspotError } from '../internal/core/errors';
import { ERRORS } from '../internal/core/errors-list';
import log from '../logger';
import type {HDAccountsUserConfig, LocalKeyringPair} from '../types';
import { RedspotNetworkAccountsUserConfig } from '../types';

let id = 0;

export class Signer implements PolkadotSigner {
  readonly #keyring: Keyring;
  #config: RedspotNetworkAccountsUserConfig = [];
  #registry: Registry;

  constructor() {
    this.#keyring = new Keyring({
      type: 'sr25519'
    });
  }

  get keyring(): Keyring {
    return this.#keyring;
  }

  init = (registry: Registry, config: RedspotNetworkAccountsUserConfig) => {
    this.#config = config;
    this.#registry = registry;
  };

  public findKeyringPair = (address: string) => {
    const pairs = this.#keyring.getPairs();

    const findKeyringPair = pairs.find((pair) =>
      this.#registry.createType('AccountId', pair.address).eq(address)
    );

    if (!findKeyringPair) {
      throw new Error(`Can't find the keyringpair for ${address}`);
    }

    return findKeyringPair;
  };

  public signRaw = async (raw: SignerPayloadRaw): Promise<SignerResult> => {
    return new Promise((resolve): void => {
      const signed = this.findKeyringPair(raw.address).sign(raw.data);

      resolve({ id: ++id, signature: u8aToHex(signed) });
    });
  };

  public signPayload = async (
    payload: SignerPayloadJSON
  ): Promise<SignerResult> => {
    const pair = this.findKeyringPair(payload.address);
    return new Promise((resolve): void => {
      const signed = this.#registry
        .createType('ExtrinsicPayload', payload, { version: payload.version })
        .sign(pair);

      resolve({ id: ++id, ...signed });
    });
  };

  public setUp = () => {
    for (const account of this.#config) {
      let pair: KeyringPair | LocalKeyringPair;

      if (typeof account === 'string') {
        try {
          const meta = {
            name: account.replace('//', '_').toLowerCase()
          };

          pair = this.keyring.addFromUri(account, meta);
          (pair as LocalKeyringPair).suri = account;

          pair.lock = (): void => {};
        } catch (error) {
          log.error(error.message);
          throw new RedspotError(ERRORS.GENERAL.BAD_SURI, { uri: account });
        }
      }
      else if (typeof account == 'object') {
        const _account = account as HDAccountsUserConfig
        try {
          const mnemonic = _account.mnemonic;

          pair = this.keyring.addFromUri(mnemonic);
          (pair as LocalKeyringPair).suri = mnemonic;

          if (_account.path) {
            let initialIndex = _account.initialIndex || 0;
            let count = _account.count || 20;
            pair.lock = (): void => {};
            if (initialIndex >= count) {
              return;
            }
            for (let i = initialIndex; i < count; i++) {
              const derivedPath = `${_account.path}/${i}`;
              const childPair = pair.derive(derivedPath);
              (childPair as LocalKeyringPair).suri = mnemonic + derivedPath;
              this.keyring.addPair(childPair)
            }
          }
        } catch (error) {
          log.error(error.message)
          throw new RedspotError(ERRORS.GENERAL.BAD_SURI, { uri: _account.mnemonic });
        }

      }
    }
  };

  public getPairs = () => {
    return this.keyring.getPairs();
  };

  public addPair = (pair: KeyringPair): KeyringPair => {
    return this.keyring.addPair(pair);
  };
}
