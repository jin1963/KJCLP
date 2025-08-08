function contracts() {
  const usdt = new ethers.Contract(CONFIG.usdt, ERC20_MINI_ABI, signer);
  const auto = new ethers.Contract(CONFIG.autoStaker, AUTO_STAKER_ABI, signer);
  return { usdt, auto };
}

async function refresh() {
  if (!signer) return;
  const { auto } = contracts();
  const me = await signer.getAddress();

  const len = await auto.stakesLength(me);
  let text = `จำนวนโพสิชัน: ${len}\n`;
  for (let i=0;i<len;i++) {
    const s = await auto.stakeInfo(me, i);
    const amt = fmt(s.amount, CONFIG.lpDecimals);
    const start = new Date(s.startTime.toNumber()*1000).toLocaleString();
    const last  = new Date(s.lastClaim.toNumber()*1000).toLocaleString();
    const next  = await auto.nextClaimTime(me, i);
    const unl   = await auto.unlockTime(me, i);
    const canW  = await auto.canWithdrawIndex(me, i);
    text += `#${i} | LP=${amt}\n  start=${start}\n  last=${last}\n  next=${new Date(next.toNumber()*1000).toLocaleString()}\n  unlock=${new Date(unl.toNumber()*1000).toLocaleString()}\n  canWithdraw=${canW}\n`;
  }

  const ref = await auto.claimableReferralReward(me);
  document.getElementById('uiRefRewards').textContent = `Referral KJC claimable: ${fmt(ref, CONFIG.kjcDecimals)}`;
  document.getElementById('stakesBox').textContent = text;
}

async function setRef() {
  const addr = document.getElementById('refAddress').value.trim();
  if (!ethers.utils.isAddress(addr)) return alert('Referrer ไม่ถูกต้อง');
  const { auto } = contracts();
  const tx = await auto.setReferrer(addr);
  await tx.wait();
  alert('ตั้งค่า Referrer เรียบร้อย');
  refresh();
}

async function buyStake() {
  const amtStr = document.getElementById('usdtAmount').value.trim();
  if (!amtStr || Number(amtStr)<=0) return alert('กรุณากรอกจำนวน USDT');
  const amount = ethers.utils.parseUnits(amtStr, CONFIG.usdtDecimals);

  const { usdt, auto } = contracts();
  const me = await signer.getAddress();

  // อนุมัติให้สัญญา autoStaker ดึง USDT
  const alw = await usdt.allowance(me, CONFIG.autoStaker);
  if (alw.lt(amount)) {
    const tx1 = await usdt.approve(CONFIG.autoStaker, ethers.constants.MaxUint256);
    await tx1.wait();
  }
  // call buyAndStake(usdtAmount, 0)
  const tx2 = await auto.buyAndStake(amount, 0);
  await tx2.wait();
  alert('ซื้อ + เพิ่มสภาพคล่อง + Stake สำเร็จ');
  refresh();
}

async function claimStake() {
  const { auto } = contracts();
  const tx = await auto.claimStakingReward();
  await tx.wait();
  alert('เคลมรางวัล Staking สำเร็จ');
  refresh();
}

async function claimRef() {
  const { auto } = contracts();
  const tx = await auto.claimReferralReward();
  await tx.wait();
  alert('เคลม Referral Rewards สำเร็จ');
  refresh();
}

async function withdrawByIndex() {
  const iStr = document.getElementById('idx').value.trim();
  if (iStr === '') return alert('กรุณาใส่ index');
  const i = parseInt(iStr,10);
  const { auto } = contracts();
  const tx = await auto.withdrawByIndex(i);
  await tx.wait();
  alert('ถอน LP โพสิชันดังกล่าวสำเร็จ');
  refresh();
}

async function withdrawAll() {
  const { auto } = contracts();
  const tx = await auto.withdrawAllUnlocked();
  await tx.wait();
  alert('ถอน LP ที่ปลดล็อกทั้งหมดสำเร็จ');
  refresh();
}

document.getElementById('btnSetRef').onclick = setRef;
document.getElementById('btnBuyStake').onclick = buyStake;
document.getElementById('btnRefresh').onclick = refresh;
document.getElementById('btnClaimStake').onclick = claimStake;
document.getElementById('btnClaimRef').onclick = claimRef;
document.getElementById('btnWithdrawByIndex').onclick = withdrawByIndex;
document.getElementById('btnWithdrawAll').onclick = withdrawAll;

// auto refresh เผื่อหน้าโหลดหลังเชื่อมกระเป๋า
window.addEventListener('load', () => setTimeout(refresh, 800));
