// staking.js — ใช้ร่วมกับ config.js (ที่รวม ABI/ที่อยู่ไว้แล้ว)
const MAX_UINT = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

function ctrAuto() {
  return new web3.eth.Contract(AUTO_STAKER_ABI, CONFIG.autoStaker);
}
function ctrERC20(addr) {
  return new web3.eth.Contract(ERC20_MINI_ABI, addr);
}
function ctrRouter() {
  // ใช้แค่ getAmountsOut สำหรับประเมินราคา (อยู่ในสัญญา Router V2)
  const ABI = [{"constant":true,"inputs":[{"name":"amountIn","type":"uint256"},{"name":"path","type":"address[]"}],"name":"getAmountsOut","outputs":[{"name":"","type":"uint256[]"}],"payable":false,"stateMutability":"view","type":"function"}];
  return new web3.eth.Contract(ABI, CONFIG.router);
}

// helper แปลงทศนิยม 18
function toUnit18(numStr) { return web3.utils.toWei(numStr, 'ether'); }
function fromUnit18(bnStr, precision=6) {
  const s = web3.utils.fromWei(bnStr, 'ether');
  const [i,d=''] = s.split('.');
  return d ? `${i}.${d.slice(0,precision)}` : i;
}

async function setReferrer() {
  try {
    if (!account) return alert('กรุณาเชื่อมต่อกระเป๋าก่อน');
    const ref = document.getElementById('refAddress').value.trim();
    if (!web3.utils.isAddress(ref)) return alert('Referrer ไม่ถูกต้อง');
    const auto = ctrAuto();
    const tx = await auto.methods.setReferrer(ref).send({ from: account });
    alert('ตั้งค่า Referrer เรียบร้อย');
    fetchAndRenderUser();
  } catch (e) {
    console.error(e);
    alert('ตั้งค่า Referrer ไม่สำเร็จ');
  }
}

async function quoteKJC() {
  try {
    if (!account) return alert('เชื่อมกระเป๋าก่อน');
    const amtStr = document.getElementById('usdtAmount').value.trim();
    if (!amtStr || Number(amtStr)<=0) return alert('กรอกจำนวน USDT');
    const half = toUnit18((Number(amtStr)/2).toString());
    const router = ctrRouter();
    const out = await router.methods.getAmountsOut(half, [CONFIG.usdt, CONFIG.kjc]).call();
    const kjcOut = out[1];
    document.getElementById('quoteBox').textContent = `ประมาณการ KJC ~ ${fromUnit18(kjcOut)} (จาก USDT ${Number(amtStr)/2})`;
  } catch (e) {
    console.error(e);
    document.getElementById('quoteBox').textContent = '-';
    alert('ประเมินราคาไม่สำเร็จ (อาจเพราะ path/สภาพคล่อง)');
  }
}

async function buyAndStake() {
  try {
    if (!account) return alert('เชื่อมกระเป๋าก่อน');
    const amtStr = document.getElementById('usdtAmount').value.trim();
    if (!amtStr || Number(amtStr)<=0) return alert('กรอกจำนวน USDT');

    const amount = toUnit18(amtStr);
    const usdt = ctrERC20(CONFIG.usdt);
    const auto = ctrAuto();

    // อนุมัติให้สัญญาดึง USDT
    const allowance = await usdt.methods.allowance(account, CONFIG.autoStaker).call();
    if (web3.utils.toBN(allowance).lt(web3.utils.toBN(amount))) {
      await usdt.methods.approve(CONFIG.autoStaker, MAX_UINT).send({ from: account });
    }

    // call buyAndStake(usdtAmount, 0)
    await auto.methods.buyAndStake(amount, 0).send({ from: account });
    alert('สำเร็จ: ซื้อ → Add LP → Stake');
    fetchAndRenderUser();
  } catch (e) {
    console.error(e);
    alert(e?.message || 'ทำรายการไม่สำเร็จ');
  }
}

async function fetchAndRenderUser() {
  try {
    if (!account) return;
    const auto = ctrAuto();

    // อ่านจำนวนโพสิชัน
    const len = Number(await auto.methods.stakesLength(account).call());
    let totalLP = web3.utils.toBN('0');
    let earliestNext = null;
    let earliestUnlock = null;
    let canWithdrawAny = false;

    for (let i=0;i<len;i++) {
      const s = await auto.methods.stakeInfo(account, i).call();
      totalLP = totalLP.add(web3.utils.toBN(s.amount));

      const next = await auto.methods.nextClaimTime(account, i).call();
      const unl  = await auto.methods.unlockTime(account, i).call();
      const canW = await auto.methods.canWithdrawIndex(account, i).call();

      if (next > 0 && (earliestNext===null || Number(next) < earliestNext)) earliestNext = Number(next);
      if (unl  > 0 && (earliestUnlock===null || Number(unl)  < earliestUnlock)) earliestUnlock = Number(unl);
      if (canW) canWithdrawAny = true;
    }

    // อัปเดต UI แบบรวม
    document.getElementById('uiStakedLP').textContent = len ? fromUnit18(totalLP.toString()) : '-';
    document.getElementById('uiLastClaim').textContent = '(อ้างอิงรายโพสิชัน)';
    document.getElementById('uiNextClaim').textContent = earliestNext ? new Date(earliestNext*1000).toLocaleString() : '-';
    document.getElementById('uiUnlockAt').textContent = earliestUnlock ? new Date(earliestUnlock*1000).toLocaleString() : '-';
    document.getElementById('uiCanWithdraw').textContent = canWithdrawAny ? 'พร้อมถอนบางโพสิชัน' : 'ยังไม่ครบกำหนด';

    const ref = await auto.methods.claimableReferralReward(account).call();
    document.getElementById('uiRefRewards').textContent = fromUnit18(ref) + ' KJC';
  } catch (e) {
    console.error(e);
  }
}

async function withdrawLP() {
  try {
    if (!account) return alert('เชื่อมกระเป๋าก่อน');
    const auto = ctrAuto();
    await auto.methods.withdrawAllUnlocked().send({ from: account });
    alert('ถอน LP ที่ปลดล็อกแล้วสำเร็จ');
    fetchAndRenderUser();
  } catch (e) {
    console.error(e);
    alert('ถอน LP ไม่สำเร็จ');
  }
}

async function claimStakingReward() {
  try {
    if (!account) return alert('เชื่อมกระเป๋าก่อน');
    const auto = ctrAuto();
    await auto.methods.claimStakingReward().send({ from: account });
    alert('เคลมรางวัล Staking สำเร็จ');
    fetchAndRenderUser();
  } catch (e) {
    console.error(e);
    alert('เคลมรางวัลไม่สำเร็จ (ยังไม่ถึงรอบหรือ KJC ไม่พอในสัญญา)');
  }
}

async function claimReferralReward() {
  try {
    if (!account) return alert('เชื่อมกระเป๋าก่อน');
    const auto = ctrAuto();
    await auto.methods.claimReferralReward().send({ from: account });
    alert('เคลม Referral สำเร็จ');
    fetchAndRenderUser();
  } catch (e) {
    console.error(e);
    alert('เคลม Referral ไม่สำเร็จ');
  }
}
