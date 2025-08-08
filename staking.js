/* staking.js — Web3.js full version (robust)
   ต้องมีตัวแปรจาก wallet.js: web3, account, usdt, staker, router
   ต้องมีปุ่ม/element id ตาม index.html: quoteBox, uiStakedLP, uiLastClaim, uiNextClaim, uiUnlockAt, uiCanWithdraw, uiRefRewards, btnClaimStake, btnClaimRef, btnWithdraw
*/

function toast(msg){ try{ alert(msg); }catch(_){} console.log(msg); }

// ---------- Referral ----------
async function setReferrer() {
  try {
    const ref = document.getElementById("refAddress").value.trim();
    if (!web3.utils.isAddress(ref)) return toast("Referrer ไม่ถูกต้อง");
    const gas = await staker.methods.setReferrer(ref).estimateGas({ from: account }).then(g=>Math.floor(g*1.15));
    const p = staker.methods.setReferrer(ref).send({ from: account, gas });
    p.on("transactionHash", h => toast("📤 ส่งคำสั่งสมัคร Referrer แล้ว\nTx: "+h))
     .on("receipt", () => toast("✅ สมัคร Referrer สำเร็จ"));
    await p;
    localStorage.setItem("kjc_referrer", ref);
  } catch (e) { console.error(e); toast("สมัครไม่สำเร็จ: "+(e?.message||e)); }
}

// ---------- Quote / Buy & Stake ----------
async function quoteKJC() {
  try {
    if (!account) return toast("กรุณาเชื่อมต่อกระเป๋าก่อน");
    const amount = document.getElementById("usdtAmount").value;
    if (!amount || Number(amount) <= 0) return toast("กรอกจำนวน USDT ก่อน");
    const usdtWei = web3.utils.toWei(amount, "ether"); // USDT 18d
    const out = await router.methods.getAmountsOut(usdtWei, [CONFIG.usdt, CONFIG.kjc]).call();
    const kjcOut = web3.utils.fromWei(out[1], "ether");
    document.getElementById("quoteBox").innerText = `คาดว่าจะได้ ~ ${kjcOut} KJC`;
  } catch (e) { console.error(e); toast("ประเมินไม่สำเร็จ: "+(e?.message||e)); }
}

async function buyAndStake() {
  try {
    if (!account) return toast("กรุณาเชื่อมต่อกระเป๋าก่อน");
    const amount = document.getElementById("usdtAmount").value;
    if (!amount || Number(amount) <= 0) return toast("กรอกจำนวน USDT ก่อน");
    const usdtWei = web3.utils.toWei(amount, "ether");

    // ต้องมี BNB จ่ายแก๊ส
    const bnbBal = await web3.eth.getBalance(account);
    if (web3.utils.toBN(bnbBal).isZero()) return toast("เติม BNB สำหรับค่าแก๊สบน BSC ก่อนทำรายการ");

    // 1) Approve USDT ถ้าจำเป็น
    const allowance = await usdt.methods.allowance(account, CONFIG.autoStaker).call();
    if (web3.utils.toBN(allowance).lt(web3.utils.toBN(usdtWei))) {
      toast("⏳ ส่งคำสั่ง Approve USDT…");
      const gas1 = await usdt.methods.approve(CONFIG.autoStaker, usdtWei).estimateGas({ from: account }).then(g=>Math.floor(g*1.15));
      const p1 = usdt.methods.approve(CONFIG.autoStaker, usdtWei).send({ from: account, gas: gas1 });
      p1.on("transactionHash", h => toast("📤 Approve ส่งแล้ว\nTx: "+h))
        .on("receipt", () => toast("✅ Approve สำเร็จ"));
      await p1;
    }

    // 2) คำนวณ minKJC ใหม่ (กัน slippage ~2%)
    const out = await router.methods.getAmountsOut(usdtWei, [CONFIG.usdt, CONFIG.kjc]).call();
    const minKJC = web3.utils.toBN(out[1]).muln(98).divn(100);

    // 3) ส่ง buyAndStake
    toast("⏳ ส่งคำสั่ง Buy & Stake…");
    const gas2 = await staker.methods.buyAndStake(usdtWei, minKJC).estimateGas({ from: account, value: 0 }).then(g=>Math.floor(g*1.20));
    const p2 = staker.methods.buyAndStake(usdtWei, minKJC).send({ from: account, gas: gas2, value: 0 });
    p2.on("transactionHash", h => toast("📤 ส่งธุรกรรมแล้ว\nดูบน BscScan: "+h))
      .on("receipt", () => { toast("✅ ซื้อและ Stake สำเร็จ"); fetchAndRenderUser().catch(()=>{}); })
      .on("error", e => { throw e; });
    await p2;
  } catch (e) { console.error(e); toast("ทำรายการไม่สำเร็จ: "+(e?.message||e)); }
}

// ---------- Claim ----------
async function claimStakingReward() {
  try {
    const gas = await staker.methods.claimStakingReward().estimateGas({ from: account }).then(g=>Math.floor(g*1.15));
    const p = staker.methods.claimStakingReward().send({ from: account, gas });
    p.on("transactionHash", h => toast("📤 ส่ง Claim Staking แล้ว\nTx: "+h))
     .on("receipt", () => { toast("✅ เคลมรางวัล Staking สำเร็จ"); fetchAndRenderUser().catch(()=>{}); });
    await p;
  } catch (e) { console.error(e); toast("Claim Staking ล้มเหลว: "+(e?.message||e)); }
}

async function claimReferralReward() {
  try {
    const gas = await staker.methods.claimReferralReward().estimateGas({ from: account }).then(g=>Math.floor(g*1.15));
    const p = staker.methods.claimReferralReward().send({ from: account, gas });
    p.on("transactionHash", h => toast("📤 ส่ง Claim Referral แล้ว\nTx: "+h))
     .on("receipt", () => { toast("✅ เคลมรางวัล Referral สำเร็จ"); fetchAndRenderUser().catch(()=>{}); });
    await p;
  } catch (e) { console.error(e); toast("Claim Referral ล้มเหลว: "+(e?.message||e)); }
}

// ---------- Your Stake ----------
function fmtTime(ts){ if(!ts) return "-"; const n=Number(ts); if(!n) return "-"; return new Date(n*1000).toLocaleString(); }
function fromWei18(v){ try{ return web3.utils.fromWei(v,"ether"); }catch(_){ return "-"; } }
async function safe(p){ try{ return await p; }catch(_){ return null; } }
function setBtn(id, enabled, label){
  const b=document.getElementById(id); if(!b) return;
  if(label) b.textContent=label;
  if(enabled){ b.classList.remove("disabled"); b.removeAttribute("disabled"); }
  else{ b.classList.add("disabled"); b.setAttribute("disabled","disabled"); }
}

let unlockTimer;

async function fetchUserInfo(addr){
  // จาก ABI ล่าสุดของคุณ: ไม่มี stakedAmount/lastClaim/canWithdraw แบบแยก
  // มี users(addr) -> { referrer, referralRewards }
  // และค่าคงที่ CLAIM_INTERVAL/LOCK_DURATION แต่ไม่มีเวลาเริ่มต้น stake
  // ดังนั้นเราจะอ่านได้เฉพาะ referralRewards + พึ่งสัญญาตัดสินเรื่อง withdraw/claim
  const [userTuple, ci, ld] = await Promise.all([
    safe(staker.methods.users(addr).call()),
    safe(staker.methods.CLAIM_INTERVAL().call()),
    safe(staker.methods.LOCK_DURATION().call())
  ]);

  return {
    refRewards: userTuple ? userTuple.referralRewards : "0",
    claimInterval: ci ? Number(ci) : 0,
    lockDuration: ld ? Number(ld) : 0
    // ไม่มีข้อมูล stakedLP/lastClaim/unlock จาก ABI นี้
  };
}

async function fetchAndRenderUser(){
  if(!account) return;

  const u = await fetchUserInfo(account);

  // staked LP/เวลาเคลม/ปลดล็อก: ABI นี้ไม่มี getter → แสดง "-" และให้สัญญาตัดสินตอนกดปุ่ม
  document.getElementById("uiStakedLP").innerText = "-";
  document.getElementById("uiLastClaim").innerText = "-";
  document.getElementById("uiNextClaim").innerText = "-";
  document.getElementById("uiUnlockAt").innerText = "-";
  document.getElementById("uiCanWithdraw").innerText = "⛓️ ขึ้นกับสัญญา (ไม่มีตัวบอกเวลา)";

  // referral rewards (อ่านจาก users[address].referralRewards)
  const refBN = web3.utils.toBN(u.refRewards || "0");
  document.getElementById("uiRefRewards").innerText = refBN.isZero() ? "-" : fromWei18(refBN.toString());

  // เปิด/ปิดปุ่มเคลมแบบ conservative: เปิดไว้ แล้วให้สัญญาตัดสิน (เพราะไม่มี nextClaim/minClaim ให้เทียบ)
  setBtn("btnClaimStake", true);
  setBtn("btnClaimRef", !refBN.isZero()); // มีค่าค่อยเปิด จะได้ไม่กดทิ้ง
  setBtn("btnWithdraw", true);            // เปิดไว้ ให้สัญญาตัดสิน can/can't
}

// ถอน LP
async function withdrawLP(){
  try{
    const btn = document.getElementById("btnWithdraw");
    if(btn && btn.hasAttribute("disabled")) return toast("ยังถอน LP ไม่ได้");
    const gas = await staker.methods.withdrawLP().estimateGas({ from: account }).then(g=>Math.floor(g*1.15));
    const p = staker.methods.withdrawLP().send({ from: account, gas });
    p.on("transactionHash", h => toast("📤 ส่ง Withdraw แล้ว\nTx: "+h))
     .on("receipt", () => { toast("✅ ถอน LP สำเร็จ"); fetchAndRenderUser().catch(()=>{}); });
    await p;
  }catch(e){ console.error(e); toast("ถอน LP ล้มเหลว: "+(e?.message||e)); }
}

// auto refresh
setInterval(()=>{ if(window.account) fetchAndRenderUser().catch(()=>{}); }, 15000);
