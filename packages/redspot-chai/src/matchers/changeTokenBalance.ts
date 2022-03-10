import { bnToBn } from '@polkadot/util';
import Contract from '@redspot/patract/contract';
import type { BN } from '@polkadot/util';
import { Account, getAddressOf } from './misc/account';
declare type ContractType = typeof Contract

export function supportChangeTokenBalance(Assertion: Chai.AssertionStatic) {
  Assertion.addMethod('changeTokenBalance', function (
    this: any,
    token: ContractType,
    account: Account,
    balanceChange: BN | string | number | bigint
  ) {
    const subject = this._obj;
    if (typeof subject !== 'function') {
      this.assert(
        false,
        `Expected ${subject} to be a function`,
        `Expected ${subject} to be a function`,
        '',
        ''
      );
      return;
    }
    const derivedPromise = Promise.all([
      getBalanceChange(subject, token, account),
      getAddressOf(account)
    ]).then(([actualChange, address]) => {
      this.assert(
        actualChange.eq(bnToBn(balanceChange)),
        `Expected "${address}" to change balance by ${balanceChange}, ` +
          `but it has changed by ${actualChange}`,
        `Expected "${address}" to not change balance by ${balanceChange},`,
        balanceChange,
        actualChange
      );
    });
    this.then = derivedPromise.then.bind(derivedPromise);
    this.catch = derivedPromise.catch.bind(derivedPromise);
    this.promise = derivedPromise;
    return this;
  });
}

async function getBalanceChange(
  transactionCall: () => Promise<void> | void,
  token: ContractType,
  account: Account
) {
  const balanceBefore = await token.query.balanceOf(
    await getAddressOf(account)
  );
  await transactionCall();
  const balanceAfter = await token.query.balanceOf(await getAddressOf(account));

  return (balanceAfter.output as any).sub(balanceBefore.output);
}
