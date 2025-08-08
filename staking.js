// ===== Referral / Basic actions =====
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
  const minKJC = web3.utils.toBN(out[1]).muln(98).divn(100); // slippage ~2%

  await staker.methods.buyAndStake(usdtWei, minKJC).send({ from: account });
  alert("ซื้อและ Stake สำเร็จ");
  fetchAndRenderUser().catch(()=>{});
}

async function claimStakingReward() {
  await staker.methods.claimStakingReward().send({ from: account });
  alert("เคลมรางวัล Staking สำเร็จ");
  fetchAndRenderUser().catch(()=>{});
}

async function claimReferralReward() {
  await staker.methods.claimReferralReward().send({ from: account });
  alert("เคลมรางวัล Referral สำเร็จ");
  fetchAndRenderUser().catch(()=>{});
}

// ===== Helpers =====
function fmtTime(ts) {
  if (!ts) return "-";
  const n = Number(ts);
  if (!n) return "-";
  return new Date(n * 1000).toLocaleString();
}
function fromWei18(v) {
  try { return web3.utils.fromWei(v, "ether"); } catch { return "-"; }
}
async function safe(promise) {
  try { return await promise; } catch { return null; }
}
function setBtn(id, enabled, label) {
  const btn = document.getElementById(id);
  if (!btn) return;
  if (label) btn.textContent = label;
  if (enabled) {
    btn.classList.remove("disabled");
    btn.removeAttribute("disabled");
  } else {
    btn.classList.add("disabled");
    btn.setAttribute("disabled","disabled");
  }
}

// ===== Your Stake (real-condition aware) =====
let unlockTimer;

async function getClaimableStaking(user) {
  // ลองหลายชื่อฟังก์ชันที่พบได้ทั่วไป
  let v = await safe(staker.methods.claimableStakingReward(user).call());
  if (v != null) return v;
  v = await safe(staker.methods.pendingStakingReward(user).call());
  if (v != null) return v;
  // ไม่มีฟังก์ชันเฉพาะ: คืน "0"
  return "0";
}

async function getClaimableReferral(user) {
  let v = await safe(staker.methods.claimableReferralReward(user).call());
  if (v != null) return v;
  v = await safe(staker.methods.referralReward(user).call());
  if (v != null) return v;
  return "0";
}

async function fetchUserInfo(addr) {
  const [stakedLP, lastClaim, canW, ci, ld, apy,
         minRef, nextClaim, unlockAt,
         claimStk, claimRef] = await Promise.all([
    safe(staker.methods.stakedAmount(addr).call()),
    safe(staker.methods.lastClaim(addr).call()),
    safe(staker.methods.canWithdraw(addr).call()),
    safe(staker.methods.CLAIM_INTERVAL().call()),
    safe(staker.methods.LOCK_DURATION().call()),
    safe(staker.methods.APY().call()),
    safe(staker.methods.MIN_REF_CLAIM().call()),
    safe(staker.methods.nextClaimTime(addr).call()),
    safe(staker.methods.unlockTime(addr).call()),
    getClaimableStaking(addr),
    getClaimableReferral(addr)
  ]);

  return { stakedLP, lastClaim, canW, ci, ld, apy, minRef, nextClaim, unlockAt, claimStk, claimRef };
}

async function fetchAndRenderUser() {
  if (!window.account) return;
  const u = await fetchUserInfo(account);

  // staked LP
  document.getElementById("uiStakedLP").innerText = u.stakedLP ? fromWei18(u.stakedLP) : "-";

  // times
  const last = u.lastClaim ? Number(u.lastClaim) : 0;
  const ci = u.ci ? Number(u.ci) : 0;

  let next = u.nextClaim ? Number(u.nextClaim) : 0;
  if (!next && last && ci) next = last + ci;

  document.getElementById("uiLastClaim").innerText = last ? fmtTime(last) : "-";
  document.getElementById("uiNextClaim").innerText = next ? fmtTime(next) : "-";

  // unlockAt
  let unlockAt = u.unlockAt ? Number(u.unlockAt) : 0;
  if (!unlockAt) {
    const ld = u.ld ? Number(u.ld) : 0;
    if (last && ld) unlockAt = last + ld;
  }
  document.getElementById("uiUnlockAt").innerText = unlockAt ? fmtTime(unlockAt) : "-";

  // canWithdraw
  let canW = (u.canW === true || u.canW === false) ? u.canW : false;
  if (!canW && unlockAt) canW = Math.floor(Date.now()/1000) >= unlockAt;
  document.getElementById("uiCanWithdraw").innerText = canW ? "✅ ถอน LP ได้" : "⏳ ยังล็อกอยู่";
  setBtn("btnWithdraw", !!canW);

  // claimable amounts (ถ้ามีฟังก์ชันให้ดึง)
  const claimStk = u.claimStk ? web3.utils.toBN(u.claimStk) : web3.utils.toBN("0");
  const claimRef = u.claimRef ? web3.utils.toBN(u.claimRef) : web3.utils.toBN("0");

  document.getElementById("uiRefRewards").innerText = claimRef.gt(web3.utils.toBN("0"))
    ? fromWei18(claimRef.toString()) : "-";

  // เงื่อนไขเปิด/ปิดปุ่มเคลมตามจริง:
  // Staking: ถ้ามี nextClaimTime ใช้อันนั้น / ไม่มีให้ใช้ last + interval / ไม่มีทั้งคู่ -> เปิดไว้ (ปล่อยสัญญาตรวจ)
  let canClaimStk = true;
  const now = Math.floor(Date.now()/1000);
  if (next) canClaimStk = now >= next;
  // ถ้าสัญญามีฟังก์ชัน claimableStakingReward แล้วผลเป็น 0 ก็ปิดไว้
  if (u.claimStk != null && claimStk.isZero()) canClaimStk = false;
  setBtn("btnClaimStake", canClaimStk, "🎁 เคลมรางวัล Staking");

  // Referral: ถ้ามี MIN_REF_CLAIM ใช้เทียบ, ถ้ามี claimableReferralReward ใช้เทียบด้วย
  let canClaimRef = true;
  if (u.minRef != null) {
    const minRef = web3.utils.toBN(u.minRef);
    if (!minRef.isZero() && claimRef.lt(minRef)) canClaimRef = false;
  }
  if (u.claimRef != null && claimRef.isZero()) canClaimRef = false;
  setBtn("btnClaimRef", canClaimRef, "🎁 เคลมรางวัล Referral");

  // เคาน์ต์ดาวน์ปลดล็อก (ทุก 10 วิ)
  if (unlockTimer) clearInterval(unlockTimer);
  if (!canW && unlockAt) {
    const el = document.getElementById("uiUnlockAt");
    const tick = () => {
      const now = Math.floor(Date.now()/1000);
      const remain = unlockAt - now;
      if (remain <= 0) {
        el.innerText = "ถึงเวลาแล้ว";
        setBtn("btnWithdraw", true);
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

// auto-refresh ทุก 15 วิหลังเชื่อมต่อ
setInterval(() => { if (window.account) fetchAndRenderUser().catch(()=>{}); }, 15000);
