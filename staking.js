// ===== Referral / Basic actions (เหมือนเดิม) =====
async function setReferrer() {
  const ref = document.getElementById("refAddress").value.trim();
  if (!web3.utils.isAddress(ref)) return alert("Referrer ไม่ถูกต้อง");
  await staker.methods.setReferrer(ref).send({ from: account });
  localStorage.setItem("kjc_referrer", ref);
  alert("สมัคร Referrer สำเร็จ");
}

async function quoteKJC() {
  const amount = document.getElementById("usdtAmount").value;
  if (!amount) return alert("กรอกจำนวน USDT");
  const usdtWei = web3.utils.toWei(amount, "ether");
  const path = [CONFIG.usdt, CONFIG.kjc];
  const out = await router.methods.getAmountsOut(usdtWei, path).call();
  document.getElementById("quoteBox").innerText =
    `คาดว่าจะได้ ${web3.utils.fromWei(out[1], "ether")} KJC`;
}

async function buyAndStake() {
  const amount = document.getElementById("usdtAmount").value;
  if (!amount) return alert("กรอกจำนวน USDT");
  const usdtWei = web3.utils.toWei(amount, "ether");

  const allowance = await usdt.methods.allowance(account, CONFIG.autoStaker).call();
  if (web3.utils.toBN(allowance).lt(web3.utils.toBN(usdtWei))) {
    await usdt.methods.approve(CONFIG.autoStaker, usdtWei).send({ from: account });
  }

  const path = [CONFIG.usdt, CONFIG.kjc];
  const out = await router.methods.getAmountsOut(usdtWei, path).call();
  const minKJC = web3.utils.toBN(out[1]).muln(98).divn(100); // slippage 2%

  await staker.methods.buyAndStake(usdtWei, minKJC).send({ from: account });
  alert("ซื้อและ Stake สำเร็จ");
  fetchAndRenderUser().catch(()=>{});
}

async function claimStakingReward() {
  await staker.methods.claimStakingReward().send({ from: account });
  alert("เคลมรางวัล Staking สำเร็จ");
}

async function claimReferralReward() {
  await staker.methods.claimReferralReward().send({ from: account });
  alert("เคลมรางวัล Referral สำเร็จ");
}

// ===== Your Stake (Web3.js) =====
function fmtTime(ts) {
  if (!ts) return "-";
  const n = Number(ts);
  if (!n) return "-";
  return new Date(n * 1000).toLocaleString();
}
function fromWei18(v) {
  try { return web3.utils.fromWei(v, "ether"); } catch { return "-"; }
}

async function safe(callPromise) {
  try { return await callPromise; } catch { return null; }
}

let unlockTimer;

async function fetchUserInfo(addr) {
  const [stakedLP, lastClaim, canW, ci, ld] = await Promise.all([
    safe(staker.methods.stakedAmount(addr).call()),
    safe(staker.methods.lastClaim(addr).call()),
    safe(staker.methods.canWithdraw(addr).call()),
    safe(staker.methods.CLAIM_INTERVAL().call()),
    safe(staker.methods.LOCK_DURATION().call())
  ]);

  // ถ้า contract มี users(addr).referralRewards สามารถเติมได้ภายหลัง
  const refRewards = "-"; // placeholder (ไม่มี getter ตรงตามเวอร์ชันนี้)

  return { stakedLP, lastClaim, canW, ci, ld, refRewards };
}

function setWithdrawBtnEnabled(enabled) {
  const btn = document.getElementById("btnWithdraw");
  if (!btn) return;
  if (enabled) {
    btn.classList.remove("disabled");
    btn.removeAttribute("disabled");
  } else {
    btn.classList.add("disabled");
    btn.setAttribute("disabled","disabled");
  }
}

async function fetchAndRenderUser() {
  if (!window.account) return;
  const u = await fetchUserInfo(account);

  // staked LP
  document.getElementById("uiStakedLP").innerText =
    u.stakedLP ? fromWei18(u.stakedLP) : "-";

  // times
  const last = u.lastClaim ? Number(u.lastClaim) : 0;
  document.getElementById("uiLastClaim").innerText = last ? fmtTime(last) : "-";

  const ci = u.ci ? Number(u.ci) : 0;
  const next = (last && ci) ? (last + ci) : 0;
  document.getElementById("uiNextClaim").innerText = next ? fmtTime(next) : "-";

  // unlock estimate: ใช้ lastClaim + LOCK_DURATION ถ้าไม่มี getter เฉพาะ
  const ld = u.ld ? Number(u.ld) : 0;
  const unlockAt = (last && ld) ? (last + ld) : 0;
  document.getElementById("uiUnlockAt").innerText = unlockAt ? fmtTime(unlockAt) : "-";

  // canWithdraw
  let canW = (u.canW === true || u.canW === false) ? u.canW : false;
  if (!canW && unlockAt) {
    canW = Math.floor(Date.now()/1000) >= unlockAt;
  }
  document.getElementById("uiCanWithdraw").innerText = canW ? "✅ ถอน LP ได้" : "⏳ ยังล็อกอยู่";
  setWithdrawBtnEnabled(!!canW);

  // ref rewards (ไม่มี getter ตรงในเวอร์ชันนี้ เลยใส่ “-” ไว้ก่อน)
  document.getElementById("uiRefRewards").innerText = u.refRewards || "-";

  // countdown (ทุก 10 วิ)
  if (unlockTimer) clearInterval(unlockTimer);
  if (!canW && unlockAt) {
    const el = document.getElementById("uiUnlockAt");
    const tick = () => {
      const now = Math.floor(Date.now()/1000);
      const remain = unlockAt - now;
      if (remain <= 0) {
        el.innerText = "ถึงเวลาแล้ว";
        setWithdrawBtnEnabled(true);
        clearInterval(unlockTimer);
      } else {
        const h = Math.floor(remain/3600);
        const m = Math.floor((remain%3600)/60);
        const s = remain%60;
        el.innerText = `${h} ชม ${m} นาที ${s} วินาที`;
      }
    };
    tick();
    unlockTimer = setInterval(tick, 10000);
  }
}

async function withdrawLP() {
  if (!account) return alert("กรุณาเชื่อมต่อกระเป๋าก่อน");
  const btn = document.getElementById("btnWithdraw");
  if (btn && btn.hasAttribute("disabled")) return alert("ยังถอน LP ไม่ได้ (ยังไม่ถึงเวลา)");
  if (!confirm("ยืนยันถอน LP ทั้งหมดออกจากการล็อก?")) return;

  await staker.methods.withdrawLP().send({ from: account });
  alert("ถอน LP สำเร็จ");
  fetchAndRenderUser().catch(()=>{});
}

// auto-refresh every 15s เมื่อเชื่อมกระเป๋าแล้ว
setInterval(() => { if (window.account) fetchAndRenderUser().catch(()=>{}); }, 15000);
