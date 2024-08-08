/**
 * This script demonstrates how to build and send a complex transaction
 * that includes multiple instructions to the Solana blockchain
 */

import { Keypair, LAMPORTS_PER_SOL, SystemProgram, TransactionMessage, VersionedTransaction } from "@solana/web3.js";

import { payer, testWallet, connection, STATIC_PUBLICKEY } from "@/lib/vars";
import { explorerURL, printConsoleSeparator } from "@/lib/helpers";

(async () => {
  console.log("Payer address:", payer.publicKey.toBase58());
  console.log("Test wallet address:", testWallet.publicKey.toBase58());

  /**
   * create a simple instruction (using web3.js) to create an account
   */
  // generate a new, random address to create on chain
  const keypair = Keypair.generate(); // public key, private key

  // on-chain space to allocated (in number of bytes)
  const space = 0;

  // request the cost (in lamports) to allocate `space` number of bytes on chain
  // const lamports = await connection.getMinimumBalanceForRentExemption(space);

  // request the cost (in lamports) to allocate `space` number of bytes on chain
  // const balanceForRentExemption = await connection.getMinimumBalanceForRentExemption(space);

  // create this simple instruction using web3.js helper function
  const createAccountIx = SystemProgram.createAccount({
    // `fromPubkey` - this account will need to sign the transaction
    fromPubkey: payer.publicKey,
    // `newAccountPubkey` - the account address to create on chain
    newAccountPubkey: keypair.publicKey,
    // lamports to store in this account
    lamports: 200_000_000,
    // total space to allocate
    space,
    // the owning program for this account
    programId: SystemProgram.programId,
  });

  // create an other instruction to transfer lamports
  const transferToStaticWalletIx = SystemProgram.transfer({
    lamports: 100_000_000,
    // `fromPubkey` - from MUST sign the transaction
    fromPubkey: keypair.publicKey,
    // `toPubkey` - does NOT have to sign the transaction
    toPubkey: STATIC_PUBLICKEY,
    programId: SystemProgram.programId,
  });

  // close the account by transferring all lamports to the payer
  const closeAccountIx = SystemProgram.transfer({
    lamports: 100_000_000,
    fromPubkey: keypair.publicKey,
    toPubkey: payer.publicKey,
    programId: SystemProgram.programId,
  });

  /**
   * build the transaction to send to the blockchain
   */

  // get the latest recent blockhash
  const recentBlockhash = await connection.getLatestBlockhash().then(res => res.blockhash);

  // create a transaction message
  const message = new TransactionMessage({
    payerKey: payer.publicKey,
    recentBlockhash,
    instructions: [
      // create a new SOL acc
      createAccountIx,
      // transfer 0.1 SOL
      transferToStaticWalletIx,
      // close the account
      closeAccountIx,
    ],
  }).compileToV0Message();

  /**
   * try changing the order of the instructions inside of the message above...
   * see what happens :)
   */

  // create a versioned transaction using the message
  const tx = new VersionedTransaction(message);

  // console.log("tx before signing:", tx);

  // sign the transaction with our needed Signers (e.g. `payer` and `keypair`)
  tx.sign([payer, keypair]);

  // actually send the transaction
  const sig = await connection.sendTransaction(tx);

  /**
   * display some helper text
   */
  printConsoleSeparator();

  console.log("Transaction completed.");
  console.log(explorerURL({ txSignature: sig }));
})();
