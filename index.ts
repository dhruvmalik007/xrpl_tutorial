import {Client, Wallet, Transaction, xrpToDrops, EscrowCreate, TrustSet, TrustSetFlags, AccountSet,AccountSetAsfFlags,  } from "xrpl";
import { Payment } from "xrpl/src/models/transactions/payment";
import {AMMCreate, AMMDeposit, AMMDepositFlags} from "xrpl";
import {OfferCreate, OfferCreateFlags} from "xrpl";
class XrplExample {
    private client: Client;
    constructor(client: Client) {
        this.client = client;
    }

    async initializeXrpl() {
        await this.client.connect();
        console.log("Connected to XRPL");

        const wallet = await this.client.fundWallet();
        console.log("Wallet", wallet);

        const numWallets = 10;
        for (let i = 0; i < numWallets; i++) {
            const wallet = await this.client.fundWallet();
            console.log("Wallet", wallet);
        }

        await this.client.disconnect();
        console.log("Disconnected from XRPL");
    }

    async doTransactions() {
        await this.client.connect();
        const wallet1 = await this.client.fundWallet();
        const wallet2 = await this.client.fundWallet();

        const transaction: Transaction = {
            "TransactionType": "Payment",
            "Account": wallet1.wallet.address,
            "Destination": wallet2.wallet.address,
            "Amount": xrpToDrops(2),
        };
        console.log("Transaction", transaction);

        const result = await this.client.submitAndWait(transaction, {
            autofill: true,
            wallet: wallet1.wallet
        });
        console.log("Transaction result", result);

        const balance1 = await this.client.getBalances(wallet1.wallet.address);
        const balance2 = await this.client.getBalances(wallet2.wallet.address);
        console.log("Balance: ", balance1, balance2);
        await this.client.disconnect();
        console.log("Disconnected from XRPL");
    }

    convertStringToHexPadded(str: string): string {
        // Convert string to hexadecimal
        let hex: string = "";
        for (let i = 0; i < str.length; i++) {
          const hexChar: string = str.charCodeAt(i).toString(16);
          hex += hexChar;
        }
      
        // Pad with zeros to ensure it's 40 characters long
        const paddedHex: string = hex.padEnd(40, "0");
        return paddedHex.toUpperCase(); // Typically, hex is handled in uppercase
      }
      

    async createEscrow() {
        await this.client.connect();
        const wallet1 = await this.client.fundWallet();
        const wallet2 = await this.client.fundWallet();
        const wallet3 = await this.client.fundWallet();

        const timeEpochClose = (await this.client.request({
            command: "ledger",
            ledger_index: "validated",
        })).result.ledger.close_time;

        const escrowTransaction: EscrowCreate = {
            "TransactionType": "EscrowCreate",
            "Account": wallet1.wallet.address,
            "Destination": wallet2.wallet.address,
            "Amount": xrpToDrops(1000),
            "CancelAfter": timeEpochClose + 2,
            "FinishAfter": timeEpochClose + 10,
            "DestinationTag": 123456789,
            "Memos": [{
                "Memo": {
                    "MemoData": "Hello, this is a test memo"
                }
            }],
        };
        console.log("Escrow transaction", escrowTransaction);

        const result = await this.client.submitAndWait(escrowTransaction, {
            autofill: true,
            wallet: wallet1.wallet
        });

        console.log("Escrow transaction result", result);
        await this.client.disconnect();
        console.log("Disconnected from XRPL");
    }

    async createToken({ issuer, receiver, tokenCode, amount }: { issuer: Wallet, receiver: Wallet, tokenCode: string, amount: string }) {
        
        const trustSet: TrustSet = {
            "TransactionType": "TrustSet",
            "Account": receiver.address,
            "LimitAmount": {
                "currency": tokenCode,
                "issuer": issuer.address,
                "value": amount
            },
            Flags: TrustSetFlags.tfClearNoRipple,
            LastLedgerSequence: (await this.client.getLedgerIndex()) + 10,
        };

        console.log("TrustSet for the wallet", receiver.address, "and the issuer", issuer.address, "is", trustSet);

        const prepared_txn = await this.client.autofill(trustSet);
        console.log("Prepared transaction", prepared_txn);

        const signed = receiver.sign(prepared_txn);
        console.log("Signed transaction", signed);
        const result = await this.client.submitAndWait(signed.tx_blob);
        console.log("getting the result for the trust set", result);
        return result;
    }

    async allowTokenEmissions({ wallet }: { wallet: Wallet }) {
        const accountSet: AccountSet = {
            TransactionType: "AccountSet",
            Account: wallet.address,
            Flags: AccountSetAsfFlags.asfDefaultRipple,
        };

        const prepared_txn = await this.client.autofill(accountSet);
        console.log("Prepared transaction", prepared_txn);

        const signed = wallet.sign(prepared_txn);
        const result = await this.client.submitAndWait(signed.tx_blob);
        console.log("Enabling rippling txn result", result);
        return result;
    }

    async testTokenEmissions() {
        await this.client.connect();
        const wallet1 = await this.client.fundWallet();

        await this.allowTokenEmissions({ wallet: wallet1.wallet });

        console.log("Wallet 1 for token emissions", wallet1.wallet);

        const wallet2 = await this.client.fundWallet();

        const result = await this.createToken({ issuer: wallet1.wallet, receiver: wallet2.wallet, tokenCode: "XRP-test", amount: "100" }).catch(console.error);
        console.log("Result of the token emission:", result);

        await this.client.disconnect();
        console.log("Disconnected from XRPL");
    }
}

class AmmXrpl {

   
    async createAMM({issuer, receiver, client, tokenCode, amount1MinIn, amount2MaxOut}: {issuer: Wallet, receiver: Wallet, client: Client, tokenCode: any, amount1MinIn: string, amount2MaxOut: string}) {
        await client.connect(); // Ensure the client is connected
        try {

            const ammCreate: AMMCreate = {
                TransactionType: "AMMCreate",
                Account: receiver.address,
                TradingFee: 600,
                Amount: {
                    currency: tokenCode,
                    issuer: issuer.classicAddress,
                    value: amount1MinIn, 
                },
                Amount2: amount2MaxOut,
            }
        
            const prepared_txn = await client.autofill(ammCreate);
            console.log("Prepared transaction", prepared_txn);

            const signed = receiver.sign(prepared_txn);
            console.log("Signed transaction", signed);

            const result = await client.submitAndWait(signed.tx_blob);
            console.log("Result of the AMM creation", result);
        } catch (error) {
            console.error("Error creating AMM", error);
        } finally {
            await client.disconnect(); // Ensure the client is disconnected after operations
            console.log("Disconnected from XRPL");
        }
    }

    
    
}


// Example invocation
// const xrplClient = new XrplExample();
// xrplClient.testTokenEmissions().catch(console.error);

const client2 = new Client("wss://s.altnet.rippletest.net:51233");
client2.connect();

const testAmm = async () => {
    await client2.connect(); // Ensure the client is connected before funding wallets
    const ammXrpl = new AmmXrpl();
    const ammTokenExample = new XrplExample(client2);

    // create the token and trust set 

    // creating client , issuer , receiver
    const issuer = await client2.fundWallet();
    const receiver = (await client2.fundWallet()).wallet;

    const token = ammTokenExample.createToken({
        issuer: issuer.wallet,
        receiver: receiver,
        tokenCode: ammTokenExample.convertStringToHexPadded("XRP-test"),
        amount: "2000000"
    });
    
    console.log("token created: ", token);

    const tokenCode = ammTokenExample.convertStringToHexPadded("XRP-test");


    ammXrpl.createAMM({
        issuer: issuer.wallet,
        client: client2,
        receiver: receiver,
        tokenCode: tokenCode,
        amount1MinIn: "2000000",
        amount2MaxOut: "5000000"
    }).catch(console.error);
}


testAmm().catch(console.error);