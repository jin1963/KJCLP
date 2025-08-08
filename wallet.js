// wallet.js — สำหรับ Web3.js
let web3, account;

function hasWeb3() {
  return typeof window.ethereum !== 'undefined' || typeof window.web3 !== 'undefined';
}

async function connectWallet() {
  try {
    if (!hasWeb3()) {
      alert('กรุณาติดตั้ง MetaMask ก่อน');
      return;
    }
    // สร้าง web3 จาก provider ของ MetaMask
    if (window.ethereum) {
      web3 = new Web3(window.ethereum);
      await window.ethereum.request({ method: 'eth_requestAccounts' });
      // สลับ chain เป็น BSC ถ้าจำเป็น
      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      if (chainId !== CONFIG.chainIdHex) {
        await window.ethereum.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: CONFIG.chainIdHex }]
        });
      }
    } else {
      web3 = new Web3(window.web3.currentProvider);
    }

    const accounts = await web3.eth.getAccounts();
    account = accounts[0];
    document.getElementById('status').textContent = `✅ เชื่อมต่อแล้ว: ${account}`;

    // เติมลิงก์แนะนำอัตโนมัติ
    const myLink = `${location.origin}${location.pathname}?ref=${account}`;
    const refBox = document.getElementById('myRefLink');
    if (refBox) {
      refBox.value = myLink;
      document.getElementById('refHint').textContent = 'คัดลอกลิงก์แล้วนำไปแชร์ได้เลย';
    }

    // ถ้ามี ?ref= ใน URL ให้ใส่ในช่อง
    const url = new URL(location.href);
    const refParam = url.searchParams.get('ref');
    if (refParam && web3.utils.isAddress(refParam)) {
      const input = document.getElementById('refAddress');
      if (input && !input.value) input.value = refParam;
    }

    // รีเฟรชข้อมูล
    if (typeof fetchAndRenderUser === 'function') fetchAndRenderUser();

    // อัปเดตเมื่อผู้ใช้เปลี่ยนบัญชี/เน็ตเวิร์ก
    if (window.ethereum && window.ethereum.on) {
      window.ethereum.on('accountsChanged', () => location.reload());
      window.ethereum.on('chainChanged', () => location.reload());
    }
  } catch (err) {
    console.error(err);
    alert('เชื่อมต่อกระเป๋าไม่สำเร็จ');
  }
}

function copyRefLink() {
  const el = document.getElementById('myRefLink');
  if (!el || !el.value) return;
  el.select(); el.setSelectionRange(0, 99999);
  document.execCommand('copy');
  alert('คัดลอกลิงก์แล้ว');
}
