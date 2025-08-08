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
  const minKJC = web3.utils.toBN(out[1]).muln(98).divn(100);
  await staker.methods.buyAndStake(usdtWei, minKJC).send({ from: account });
  alert("ซื้อและ Stake สำเร็จ");
}

async function claimStakingReward() {
  await staker.methods.claimStakingReward().send({ from: account });
  alert("เคลมรางวัล Staking สำเร็จ");
}

async function claimReferralReward() {
  await staker.methods.claimReferralReward().send({ from: account });
  alert("เคลมรางวัล Referral สำเร็จ");
}
