let web3;
let account;
let usdt, staker, router;

async function connectWallet() {
  if (window.ethereum) {
    web3 = new Web3(window.ethereum);
    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      const chainId = await web3.eth.getChainId();
      if (chainId !== parseInt(CONFIG.chainId, 16)) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONFIG.chainId }]
        });
      }
      const accounts = await web3.eth.getAccounts();
      account = accounts[0];
      document.getElementById("status").innerText = `✅ เชื่อมต่อแล้ว: ${account}`;
      document.getElementById("status").className = "ok";
      initContracts();
      updateMyRefLink();
    } catch (err) {
      alert("เชื่อมต่อกระเป๋าไม่สำเร็จ: " + err.message);
    }
  } else {
    alert("กรุณาติดตั้ง MetaMask หรือเปิดจาก Bitget Wallet");
  }
}

function initContracts() {
  usdt = new web3.eth.Contract(ERC20_ABI, CONFIG.usdt);
  staker = new web3.eth.Contract(AUTO_STAKER_ABI, CONFIG.autoStaker);
  router = new web3.eth.Contract(ROUTER_ABI, CONFIG.router);
}

// ===== Referral Link =====
function baseURL() {
  return location.origin + location.pathname.replace(/index\.html?$/i, "");
}
function updateMyRefLink() {
  if (!account) return;
  const link = `${baseURL()}?ref=${account}`;
  const el = document.getElementById("myRefLink");
  if (el) {
    el.value = link;
    const hint = document.getElementById("refHint");
    if (hint) hint.textContent = "คัดลอกลิงก์นี้ไปแชร์ให้เพื่อนของคุณ";
  }
}
function copyRefLink() {
  const el = document.getElementById("myRefLink");
  if (!el || !el.value) return alert("ยังไม่มีลิงก์ (เชื่อมกระเป๋าก่อน)");
  el.select();
  el.setSelectionRange(0, 99999);
  document.execCommand("copy");
  alert("คัดลอกลิงก์แล้ว!");
}

// Auto-fill ref
function initRefFromURLOrStorage() {
  const params = new URLSearchParams(window.location.search);
  const fromUrl = params.get("ref");
  const key = "kjc_referrer";

  let ref = fromUrl && web3 && web3.utils.isAddress(fromUrl) ? fromUrl : null;
  if (!ref) {
    const saved = localStorage.getItem(key);
    if (saved && (!web3 || (web3 && web3.utils.isAddress(saved)))) {
      ref = saved;
    }
  }
  if (ref) {
    const input = document.getElementById("refAddress");
    if (input) input.value = ref;
  }

  const input = document.getElementById("refAddress");
  if (input) {
    input.addEventListener("change", () => {
      const v = input.value.trim();
      if (!web3 || web3.utils.isAddress(v)) {
        localStorage.setItem(key, v);
      }
    });
  }
}
window.addEventListener("load", initRefFromURLOrStorage);
