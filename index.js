const {
    SigningStargateClient,
    GasPrice,
} = require('@cosmjs/stargate');
const {Secp256k1HdWallet} = require('@cosmjs/amino');

const NODE_URL = 'https://rpc.your-cosmos-node.com';
const PRIVATE_KEY = 'your-private-key';
const RECIPIENT_ADDRESS = 'recipient-cosmos-address';

const GAS_ADJUSTMENT = 1.5; // Adjust as needed
const FEE_DENOM = 'uatom'; // Fee denomination
const GAS_LIMIT = 200000; // Adjust as needed

const telegramBotApiKey = 'your-telegram-bot-api-key'; // Replace with your Telegram Bot API key
const chatId = 'your-telegram-chat-id'; // Replace with your Telegram chat ID

async function connectToCosmos(privateKey, cosmosNodeUrl) {
    const wallet = await Secp256k1HdWallet.fromMnemonic(privateKey);
    const [{address}] = await wallet.getAccounts();

    console.log(`Connected to wallet address: ${address}`);

    const clientOptions = {
        prefix: 'cosmos',
        gasPrice: GasPrice.fromString('0.025uatom'), // Set an initial gas price (adjust as needed)
    };

    const client = await SigningStargateClient.connectWithSigner(
        cosmosNodeUrl,
        wallet,
        clientOptions
    );

    return {client, address};
}

async function sendTelegramNotification(message) {
    const url = `https://api.telegram.org/bot${telegramBotApiKey}/sendMessage`;
    const body = {
        chat_id: chatId,
        text: message,
    };

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!data.ok) {
        console.error(`Error sending Telegram notification: ${data.description}`);
    }
}

async function initiateTransaction(client, senderAddress, recipientAddress, gasLimit, gasAdjustment, feeDenom) {
    try {
        const account = await client.getAccount(senderAddress);
        const balance = account.coins.find((coin) => coin.denom === feeDenom);

        if (!balance) {
            console.log(`No balance found for ${feeDenom}`);
            return;
        }

        const amount = parseFloat(balance.amount);

        if (amount <= 0) {
            console.log(`Insufficient balance to initiate a transaction`);
            return;
        }

        console.log(`Initiating transaction with amount: ${amount} ${feeDenom}`);

        const fee = {
            amount: [{denom: feeDenom, amount: '5000'}], // Set a default fee (adjust as needed)
            gas: (gasLimit * gasAdjustment).toString(),
        };

        const result = await client.sendTokens(senderAddress, recipientAddress, [{
            denom: feeDenom,
            amount: amount.toFixed(6)
        }], fee);

        console.log('Transaction Result:', result);

        // Notify about the transaction
        const transactionMessage = `Transaction initiated: ${amount} ${feeDenom} to ${recipientAddress}`;
        await sendTelegramNotification(transactionMessage);

        // You can add further logic here based on the transaction result
    } catch (error) {
        console.error('Error initiating transaction:', error.message || error);
    }
}

async function main() {
    try {
        const {client, address} = await connectToCosmos(PRIVATE_KEY, NODE_URL);

        // Regularly check the balance and initiate a transaction if it exceeds the threshold
        setInterval(async () => {
            const account = await client.getAccount(address);
            const balance = account.coins.find((coin) => coin.denom === FEE_DENOM);

            if (balance) {
                const amount = parseFloat(balance.amount);
                console.log(`Current balance: ${amount} ${FEE_DENOM}`);

                // Notify about the new balance
                const balanceMessage = `New balance detected: ${amount} ${FEE_DENOM}`;
                await sendTelegramNotification(balanceMessage);

                if (amount > 100) {
                    // Replace 100 with your threshold
                    await initiateTransaction(client, address, RECIPIENT_ADDRESS, GAS_LIMIT, GAS_ADJUSTMENT, FEE_DENOM);
                }
            } else {
                console.log(`No balance found for ${FEE_DENOM}`);
            }
        }, 5000); // Check every 5 seconds (adjust as needed)
    } catch (error) {
        console.error('Error connecting to COSMOS blockchain:', error.message || error);
    }
}

// Run the main function
main().catch(console.error);
