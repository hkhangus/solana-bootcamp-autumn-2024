/**
 * Create account mint token
 * Create token
 * Mint token
 */

import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  createInitializeMint2Instruction,
  createMintToInstruction,
  createAssociatedTokenAccountInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

import {
  PROGRAM_ID as METADATA_PROGRAM_ID,
  createCreateMetadataAccountV3Instruction,
} from "@metaplex-foundation/mpl-token-metadata";

import { payer, testWallet, connection, STATIC_PUBLICKEY } from "@/lib/vars";

import {
  buildTransaction,
  explorerURL,
  extractSignatureFromFailedTransaction,
  printConsoleSeparator,
  savePublicKeyToFile,
} from "@/lib/helpers";

(async () => {
  console.log("Payer address:", payer.publicKey.toBase58());
  console.log("Test wallet address:", testWallet.publicKey.toBase58());

  // generate a new keypair to be used for our mint
  const mintKeypair = Keypair.generate();

  console.log("Mint address:", mintKeypair.publicKey.toBase58());

  // define the assorted token config settings
  const tokenConfig = {
    // define how many decimals we want our tokens to have
    decimals: 6,
    //
    name: "Pepe Token",
    //
    symbol: "PP",
    //
    uri: "https://raw.githubusercontent.com/hkhangus/solana-bootcamp-autumn-2024/main/week-2/assignment/assets/pepe-token.json",
  };

  /**
   * Build the 2 instructions required to create the token mint:
   * - standard "create account" to allocate space on chain
   * - initialize the token mint
   */

  // create instruction for the token mint account
  const createMintAccountInstruction = SystemProgram.createAccount({
    fromPubkey: payer.publicKey,
    newAccountPubkey: mintKeypair.publicKey,
    // the `space` required for a token mint is accessible in the `@solana/spl-token` sdk
    space: MINT_SIZE,
    // store enough lamports needed for our `space` to be rent exempt
    lamports: await connection.getMinimumBalanceForRentExemption(MINT_SIZE),
    // tokens are owned by the "token program"
    programId: TOKEN_PROGRAM_ID,
  });

  // Initialize that account as a Mint
  const initializeMintInstruction = createInitializeMint2Instruction(
    mintKeypair.publicKey,
    tokenConfig.decimals,
    payer.publicKey,
    payer.publicKey,
  );

  /**
   * Build the instruction to store the token's metadata on chain
   * - derive the pda for the metadata account
   * - create the instruction with the actual metadata in it
   */

  // derive the pda address for the Metadata account
  const metadataAccount = PublicKey.findProgramAddressSync(
    [Buffer.from("metadata"), METADATA_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
    METADATA_PROGRAM_ID,
  )[0];

  console.log("Metadata address:", metadataAccount.toBase58());

  // Create the Metadata account for the Mint
  const createMetadataInstruction = createCreateMetadataAccountV3Instruction(
    {
      metadata: metadataAccount,
      mint: mintKeypair.publicKey,
      mintAuthority: payer.publicKey,
      payer: payer.publicKey,
      updateAuthority: payer.publicKey,
    },
    {
      createMetadataAccountArgsV3: {
        data: {
          creators: null,
          name: tokenConfig.name,
          symbol: tokenConfig.symbol,
          uri: tokenConfig.uri,
          sellerFeeBasisPoints: 0,
          collection: null,
          uses: null,
        },
        // `collectionDetails` - for non-nft type tokens, normally set to `null` to not have a value set
        collectionDetails: null,
        // should the metadata be updatable?
        isMutable: true,
      },
    },
  );

  // Mint to self account
  const associatedToken
   = PublicKey.findProgramAddressSync(
    [payer.publicKey.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const createAssociatedTokenAccountSelfInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    associatedToken[0],
    payer.publicKey,
    mintKeypair.publicKey,
  );

  const mintTokenToSelfInstruction = createMintToInstruction(
    mintKeypair.publicKey,
    associatedToken[0],
    payer.publicKey,
    100_000_000,
  );

  // Mint to static account
  const associatedToken2
   = PublicKey.findProgramAddressSync(
    [STATIC_PUBLICKEY.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mintKeypair.publicKey.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  const createAssociatedTokenAccountStaticInstruction = createAssociatedTokenAccountInstruction(
    payer.publicKey,
    associatedToken2[0],
    STATIC_PUBLICKEY,
    mintKeypair.publicKey,
  );

  const mintTokenToStaticAddressInstruction = createMintToInstruction(
    mintKeypair.publicKey,
    associatedToken2[0],
    payer.publicKey,
    10_000_000,
  );

  /**
   * Build the transaction to send to the blockchain
   */

  const tx = await buildTransaction({
    connection,
    payer: payer.publicKey,
    signers: [payer, mintKeypair],
    instructions: [
      createMintAccountInstruction,
      initializeMintInstruction,
      createMetadataInstruction,
      createAssociatedTokenAccountSelfInstruction,
      mintTokenToSelfInstruction,
      createAssociatedTokenAccountStaticInstruction,
      mintTokenToStaticAddressInstruction,
    ],
  });

  printConsoleSeparator();

  try {
    // actually send the transaction
    const sig = await connection.sendTransaction(tx);

    // print the explorer url
    console.log("Transaction completed.");
    console.log(explorerURL({ txSignature: sig }));

    // locally save our addresses for the demo
    savePublicKeyToFile("tokenMint", mintKeypair.publicKey);
  } catch (err) {
    console.error("Failed to send transaction:");
    console.log(tx);

    // attempt to extract the signature from the failed transaction
    const failedSig = await extractSignatureFromFailedTransaction(connection, err);
    if (failedSig) console.log("Failed signature:", explorerURL({ txSignature: failedSig }));

    throw err;
  }
})();
