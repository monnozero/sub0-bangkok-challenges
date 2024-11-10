// import dedotLogo from './assets/dedot-dark-logo.png';
// import { Container, Flex, Heading } from '@chakra-ui/react';

// function App() {
//   // 1. Connect to SubWallet
//   // 2. Show connected account (name & address)
//   // 3. Initialize `DedotClient` to connect to the network (Westend testnet)
//   // 4. Fetch & show balance for connected account
//   // 5. Build a form to transfer balance (destination address & amount to transfer)
//   // 6. Check transaction status (in-block & finalized)
//   // 7. Check transaction result (success or not)
//   // 8. Subscribe to balance changing

//   return (
//     <Container maxW='container.md' my={16}>
//       <Flex justifyContent='center'>
//         <a href='https://dedot.dev' target='_blank'>
//           <img width='100' src={dedotLogo} className='logo' alt='Vite logo' />
//         </a>
//       </Flex>
//       <Heading my={4} textAlign='center'>
//         Open Hack Dedot
//       </Heading>
//     </Container>
//   );
// }

// export default App;

import React, { useState, useEffect } from 'react';
import { Injected, InjectedAccount, InjectedWindowProvider, InjectedWindow } from '@polkadot/extension-inject/types';
import { DedotClient, WsProvider } from 'dedot';
import { WestendApi } from '@dedot/chaintypes';
import { WESTEND } from './networks';
import { FrameSystemAccountInfo } from '@dedot/chaintypes/westend';
import { formatBalance } from './utils';

// Thay thế bằng endpoint của Westend
const WESTEND_ENDPOINT = 'wss://westend-rpc.polkadot.io';

const App: React.FC = () => {
  const [accounts, setAccounts] = useState<InjectedAccount[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [client, setClient] = useState<DedotClient<WestendApi> | null>(null);

  const [connected, setConnected] = useState<boolean>(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [injected, setInjected] = useState<Injected | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [destAddress, setDestAddress] = useState<string>('');
  const [amount, setAmount] = useState<number>(1);
  //   // 1. Connect to SubWallet
  //   // 2. Show connected account (name & address)

  const connectSubWalletAndShowAccount = async (): Promise<InjectedAccount[]> => {
    const injectedWindow = window as Window & InjectedWindow;

    // Get subwallet-js injected provider to connect with SubWallet
    const provider: InjectedWindowProvider = injectedWindow.injectedWeb3['subwallet-js'];

    // Connect with SubWallet from the dapp
    const injected: Injected = await provider.enable!('Open Hack Dapp');
    setInjected(injected);
    // Get connected accounts
    const accounts: InjectedAccount[] = await injected.accounts.get();
    return accounts;
  };

  //   // 3. Initialize `DedotClient` to connect to the network (Westend testnet)
  const initializeClient = async (endpoint: string): Promise<DedotClient<WestendApi>> => {
    // initialize the client and connect to the network
    const client = new DedotClient<WestendApi>(new WsProvider(WESTEND.endpoint));
    await client.connect();

    return client;
  };

  //   // 4. Fetch & show balance for connected account
  const fetchBalance = async (client: DedotClient<any>, connectedAccounts: InjectedAccount): Promise<string> => {
    //
    const account: InjectedAccount = connectedAccounts; // get from accounts list - 6.2
    const balance: FrameSystemAccountInfo = await client.query.system.account(account.address);

    // Get free/transferable balance
    const freeBalance = formatBalance(balance.data.free, WESTEND.decimals);
    return freeBalance;
  };

  // 5. Build a form to transfer balance (destination address & amount to transfer)
  const handleTransfer = async () => {
    if (!client || !accounts || !injected) {
      setError('Missing necessary information (client, account, or injected wallet)');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
    
      // Convert the amount (DOT, or WND) to Planck unit
      const amountToTransfer: bigint = BigInt(amount) * BigInt(Math.pow(10, WESTEND.decimals));

      await client.tx.balances
        .transferKeepAlive(destAddress, amountToTransfer)
        .signAndSend(accounts[0].address, { signer: injected.signer }, (result) => {
          console.log(result.status);

          // 'BestChainBlockIncluded': Transaction is included in the best block of the chain
          // 'Finalized': Transaction is finalized
          if (result.status.type === 'BestChainBlockIncluded' || result.status.type === 'Finalized') {
            if (result.dispatchError) {
              const error = `${JSON.stringify(Object.values(result.dispatchError))}`;
              setError(`Transaction error: ${error}`);
            } else {
              alert('Transaction successful!');
            }
          }
        });
    } catch (err) {
      console.error('Transfer failed:', err);
      setError('Transfer failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  //   // 6. Check transaction status (in-block & finalized)
//   // 7. Check transaction result (success or not)
//   // 8. Subscribe to balance changing

  const subscribeToBalanceChanges = async (
    client: DedotClient<any>, connectedAccounts: InjectedAccount
  ) : Promise<() => void>  => {
    try {
      const account: InjectedAccount = connectedAccounts; // get from accounts list - 6.2

      // Pass in a callback to be called whenver the balance is changed/updated
      const unsub = await client.query.system.account(account.address, (balance: FrameSystemAccountInfo) => {
        // Get free/transferable balance
        const freeBalance = formatBalance(balance.data.free, WESTEND.decimals);  
        setBalance(freeBalance);
      });
      return unsub;
    } catch (err) {
      console.error('Failed to subscribe to balance changes', err);
      throw new Error('Failed to subscribe to balance changes');
    }
  };
  useEffect(() => {
    const setup = async () => {
      try {
        const connectedAccounts = await connectSubWalletAndShowAccount();
        setAccounts(connectedAccounts);

        if (connectedAccounts.length > 0) {
          const dedotClient = await initializeClient(WESTEND_ENDPOINT);
          setClient(dedotClient);

          const balance = await fetchBalance(dedotClient, connectedAccounts[0]);
          setBalance(balance);

          if(dedotClient) {
            const unsub = await subscribeToBalanceChanges(dedotClient, connectedAccounts[0]);

            // Cleanup khi component unmount
            return () => {
              unsub(); // Hủy đăng ký khi component bị hủy
            };
          }
          
        }

        
      } catch (err) {
        console.error('Error:', err);
        setError('Failed to connect or fetch data');
      }
    };

    setup();
  }, []);
  return (
    <div>
      <h1>Connect to SubWallet</h1>
      {error ? (
        <p style={{ color: 'red' }}>{error}</p>
      ) : (
        <div>
          {accounts.length > 0 ? (
            accounts.map((account, index) => (
              <p key={index}>
                {account.name || 'Unnamed'} ({account.address})
              </p>
            ))
          ) : (
            <p>Loading accounts...</p>
          )}

          {balance ? <p>Free Balance: {balance} WND</p> : <p>Loading balance...</p>}

          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            flexDirection: 'column',
            width: '100%',
            padding: '20px',
            backgroundColor: '#f5f5f5',
            borderRadius: '5px',
            marginBottom: '10px',
            boxShadow: '0 0 5px rgba(0, 0, 0, 0.2)',
            gap:'2px'
          }}>
            <h1 >Transfer Funds</h1>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <div >
              <label
              style={{
                display: 'flex',
              flexDirection:'column'
              }}
              >
                Destination Address:
                <input
                style={{
                  border: '1px solid',
                  padding: '4px',
                  marginBottom: '10px',
                  width: '300px',
                  borderRadius: '5px',
                  outline: 'none',
                }}
                  type='text'
                  value={destAddress}
                  onChange={(e) => setDestAddress(e.target.value)}
                  placeholder='Enter destination address'
                />
              </label>
            </div>
            <div>
              <label
              style={{
                display: 'flex',
              flexDirection:'column'
              }}
              >
                Amount:
                <input
                 style={{
                  border: '1px solid',
                  padding: '4px',
                  marginBottom: '10px',
                  width: '300px',
                  borderRadius: '5px',
                  outline: 'none',
                }}
                
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  placeholder='Enter amount to transfer'
                />
              </label>
            </div>
            <button 
            style={{
              backgroundColor: 'green',
              color: 'white',
              padding: '10px 20px',
              borderRadius: '5px',
              cursor: 'pointer',
              outline: 'none',
              border: 'none',
            }
            
            }
            onClick={handleTransfer} disabled={isLoading}>
              {isLoading ? 'Transferring...' : 'Transfer'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
