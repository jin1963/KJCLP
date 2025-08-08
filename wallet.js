let provider, signer, user;

async function ensureBSC() {
  const target = CONFIG.chainIdHex;
  const eth = window.ethereum;
  const chainId = await eth.request({ method: 'eth_chainId' });
  if (chainId !== target) {
    await eth.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: target }]
    });
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert('กรุณาติดตั้ง MetaMask');
    return;
  }
  await ensureBSC();
  provider = new ethers.providers.Web3Provider(window.ethereum);
  const accounts = await provider.send('eth_requestAccounts', []);
  signer = provider.getSigner();
  user = await signer.getAddress();
  document.getElementById('status').textContent = `✅ ${user}`;
  setTimeout(refresh, 600);
}

document.getElementById('btnConnect').onclick = connectWallet;
