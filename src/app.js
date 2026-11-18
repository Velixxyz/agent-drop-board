/**
 * Agent Drop Board frontend.
 *
 * Wallet rules (hackathon red lines, enforced by design, not just by copy):
 *  - Injected provider only (window.ethereum). No QR login, no pairing flow.
 *  - The user confirms every transaction in their own wallet. This page never
 *    signs, never auto-sends, and never asks for a seed phrase or private key.
 *  - Claims send value 0. The contract rejects any payment anyway.
 *  - No analytics, no tracking, no third-party requests. Chain reads go through
 *    the user's own wallet provider (or the optional public RPC in config.js).
 */
import { BrowserProvider, Contract, JsonRpcProvider, ZeroAddress, ethers } from "ethers";
import { BOARD_ABI, CONFIG, REVERT_MESSAGES } from "./config.js";

const els = {
  connectBtn: document.getElementById("connectBtn"),
  networkNote: document.getElementById("networkNote"),
  statusLine: document.getElementById("statusLine"),
  dropList: document.getElementById("dropList"),
  contractLine: document.getElementById("contractLine"),
};

const state = {
  provider: null,
  signer: null,
  account: null,
  chainId: null,
  contract: null,
  drops: [],
};

const ZERO = ZeroAddress;

function shorten(address) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function explorerAddressUrl(address) {
  return `https://bscscan.com/address/${address}`;
}

function explorerTxUrl(hash) {
  return `https://bscscan.com/tx/${hash}`;
}

function isDeployed() {
  return (
    CONFIG.contractAddress &&
    CONFIG.contractAddress.toLowerCase() !== ZERO.toLowerCase()
  );
}

function readProvider() {
  if (typeof window.ethereum !== "undefined") {
    return new BrowserProvider(window.ethereum);
  }
  if (CONFIG.readRpcUrl) {
    return new JsonRpcProvider(CONFIG.readRpcUrl);
  }
  return null;
}

function readContract(provider) {
  return new Contract(CONFIG.contractAddress, BOARD_ABI, provider);
}

async function refreshAccount() {
  if (!window.ethereum) return;
  const provider = new BrowserProvider(window.ethereum);
  const accounts = await provider.listAccounts();
  if (accounts.length > 0) {
    state.provider = provider;
    state.signer = await provider.getSigner();
    state.account = accounts[0].address;
    const network = await provider.getNetwork();
    state.chainId = Number(network.chainId);
  }
}

function renderContractLine() {
  els.contractLine.textContent = "";
  if (!isDeployed()) {
    els.contractLine.textContent =
      "Contract address will appear here once the board is deployed. No claims are possible until then.";
    return;
  }
  els.contractLine.append("Contract: ");
  const link = document.createElement("a");
  link.href = explorerAddressUrl(CONFIG.contractAddress);
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = CONFIG.contractAddress;
  els.contractLine.append(link);
  els.contractLine.append(" (verified source on the block explorer).");
}

function renderConnectButton() {
  if (state.account) {
    els.connectBtn.textContent = `Connected: ${shorten(state.account)}`;
  } else {
    els.connectBtn.textContent = "Connect wallet";
  }
}

function renderNetworkNote() {
  if (!state.account) {
    els.networkNote.textContent = "";
    return;
  }
  if (state.chainId === CONFIG.chainId) {
    els.networkNote.textContent = `Connected on ${CONFIG.chainName}. You can claim below.`;
  } else {
    els.networkNote.textContent = `Your wallet is on a different network (chain id ${state.chainId}). Switch to ${CONFIG.chainName} (chain id ${CONFIG.chainId}) to claim.`;
  }
}

function claimButtonLabel(drop) {
  if (!drop.active) return "Drop closed";
  if (drop.remaining === 0n) return "Sold out";
  if (drop.claimed) return "Already claimed";
  if (!state.account) return "Connect wallet to claim";
  if (state.chainId !== CONFIG.chainId) return `Switch to ${CONFIG.chainName}`;
  return "Claim (gas only)";
}

function renderDrops() {
  els.dropList.textContent = "";
  if (state.drops.length === 0) {
    els.statusLine.textContent = isDeployed()
      ? "No drops yet. Check back soon."
      : "The board is not deployed yet, so there is nothing to show.";
    return;
  }
  els.statusLine.textContent = `${state.drops.length} drop${state.drops.length === 1 ? "" : "s"} on the board.`;

  for (const drop of state.drops) {
    const card = document.createElement("article");
    card.className = "drop-card";

    const title = document.createElement("h3");
    title.textContent = drop.name;
    card.append(title);

    const status = document.createElement("span");
    status.className = "badge";
    if (!drop.active) {
      status.classList.add("badge-closed");
      status.textContent = "Closed";
    } else if (drop.remaining === 0n) {
      status.classList.add("badge-closed");
      status.textContent = "Sold out";
    } else {
      status.classList.add("badge-live");
      status.textContent = "Live";
    }
    card.append(status);

    if (drop.claimed) {
      const claimed = document.createElement("span");
      claimed.className = "badge badge-claimed";
      claimed.textContent = "You claimed this";
      claimed.style.marginLeft = "0.4rem";
      card.append(claimed);
    }

    const supply = document.createElement("p");
    supply.className = "drop-meta";
    supply.textContent = `Claimed ${drop.minted.toString()} of ${drop.maxSupply.toString()} — ${drop.remaining.toString()} left`;
    card.append(supply);

    const idLine = document.createElement("p");
    idLine.className = "drop-meta";
    idLine.textContent = `Drop #${drop.id.toString()}`;
    card.append(idLine);

    const progress = document.createElement("div");
    progress.className = "progress";
    const fill = document.createElement("span");
    const pct =
      drop.maxSupply > 0n ? Number((drop.minted * 100n) / drop.maxSupply) : 0;
    fill.style.width = `${pct}%`;
    progress.append(fill);
    card.append(progress);

    const msg = document.createElement("p");
    msg.className = "claim-msg";
    msg.id = `claim-msg-${drop.id}`;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "btn btn-primary claim-btn";
    button.textContent = claimButtonLabel(drop);
    const claimable =
      drop.active &&
      drop.remaining > 0n &&
      !drop.claimed &&
      state.account &&
      state.chainId === CONFIG.chainId;
    button.disabled = !claimable;
    button.addEventListener("click", () => onClaim(drop, button, msg));
    card.append(button);
    card.append(msg);

    els.dropList.append(card);
  }
}

function friendlyError(error) {
  const text = [error?.reason, error?.shortMessage, error?.message]
    .filter(Boolean)
    .join(" ");
  if (/user rejected|user denied/i.test(text)) {
    return "Transaction rejected in your wallet. Nothing was sent.";
  }
  for (const [name, message] of Object.entries(REVERT_MESSAGES)) {
    if (text.includes(name)) return message;
  }
  return "Claim failed. Please try again, and check the transaction in your wallet.";
}

async function onClaim(drop, button, msg) {
  if (!state.signer || !state.contract) return;
  button.disabled = true;
  msg.className = "claim-msg";
  msg.textContent = "Waiting for your confirmation in your wallet…";
  try {
    // value: 0 explicitly. The contract rejects any payment.
    const tx = await state.contract.claim(drop.id, { value: 0 });
    msg.textContent = "Transaction sent. Waiting for confirmation…";
    const receipt = await tx.wait();
    if (receipt.status !== 1) {
      throw new Error("Transaction reverted on-chain.");
    }
    msg.className = "claim-msg success";
    msg.textContent = "Claimed! The badge is now in your wallet.";
    const link = document.createElement("a");
    link.href = explorerTxUrl(tx.hash);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = " View transaction.";
    link.style.color = "inherit";
    msg.append(link);
    await loadDrops();
  } catch (error) {
    msg.className = "claim-msg error";
    msg.textContent = friendlyError(error);
    button.disabled = false;
  }
}

async function loadDrops() {
  const provider = readProvider();
  if (!provider || !isDeployed()) {
    state.drops = [];
    renderDrops();
    return;
  }
  els.statusLine.textContent = "Loading drops…";
  try {
    const contract = readContract(provider);
    const nextId = await contract.nextDropId();
    const drops = [];
    const count = Math.min(Number(nextId) - 1, CONFIG.maxDropsToScan);
    for (let i = 1; i <= count; i++) {
      const [name, maxSupply, minted, active] = await contract.drops(i);
      const remaining = await contract.remaining(i);
      let claimed = false;
      if (state.account) {
        claimed = await contract.hasClaimed(i, state.account);
      }
      drops.push({ id: BigInt(i), name, maxSupply, minted, active, remaining, claimed });
    }
    // Newest drops first.
    drops.reverse();
    state.drops = drops;
  } catch (error) {
    console.error("Failed to load drops", error);
    els.statusLine.textContent =
      "Could not load drops. Check your wallet connection and refresh.";
    state.drops = [];
  }
  renderDrops();
}

async function ensureChain() {
  if (state.chainId === CONFIG.chainId) return true;
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: CONFIG.chainHex }],
    });
    return true;
  } catch (error) {
    // 4902 = chain not added to the wallet. Ask to add it; the user approves.
    if (error?.code === 4902) {
      try {
        await window.ethereum.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: CONFIG.chainHex,
              chainName: CONFIG.chainName,
              nativeCurrency: { name: "BNB", symbol: "BNB", decimals: 18 },
              rpcUrls: ["https://bsc-rpc.publicnode.com/"],
              blockExplorerUrls: ["https://bscscan.com/"],
            },
          ],
        });
        return true;
      } catch {
        return false;
      }
    }
    return false;
  }
}

async function onConnect() {
  if (typeof window.ethereum === "undefined") {
    els.statusLine.textContent =
      "No wallet found in this browser. Install a browser wallet that supports injected providers, then refresh this page.";
    return;
  }
  try {
    const provider = new BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    state.provider = provider;
    state.signer = await provider.getSigner();
    state.account = await state.signer.getAddress();
    const network = await provider.getNetwork();
    state.chainId = Number(network.chainId);
    if (state.chainId !== CONFIG.chainId) {
      await ensureChain();
      const updated = await provider.getNetwork();
      state.chainId = Number(updated.chainId);
    }
    if (isDeployed()) {
      state.contract = new Contract(CONFIG.contractAddress, BOARD_ABI, state.signer);
    }
    renderConnectButton();
    renderNetworkNote();
    await loadDrops();
  } catch (error) {
    if (/user rejected|user denied/i.test(error?.message ?? "")) {
      els.statusLine.textContent = "Connection rejected in your wallet.";
    } else {
      console.error("Connect failed", error);
      els.statusLine.textContent = "Could not connect to your wallet. Please try again.";
    }
  }
}

function watchWalletEvents() {
  if (typeof window.ethereum === "undefined" || !window.ethereum.on) return;
  window.ethereum.on("accountsChanged", (accounts) => {
    state.account = accounts.length > 0 ? ethers.getAddress(accounts[0]) : null;
    if (!state.account) {
      state.signer = null;
      state.contract = null;
    } else if (state.provider && isDeployed()) {
      state.provider.getSigner().then((signer) => {
        state.signer = signer;
        state.contract = new Contract(CONFIG.contractAddress, BOARD_ABI, signer);
        loadDrops();
      });
    }
    renderConnectButton();
    renderNetworkNote();
    loadDrops();
  });
  window.ethereum.on("chainChanged", async () => {
    if (state.provider) {
      const network = await state.provider.getNetwork();
      state.chainId = Number(network.chainId);
    }
    renderNetworkNote();
    renderDrops();
  });
}

async function init() {
  renderContractLine();
  renderConnectButton();
  if (typeof window.ethereum !== "undefined") {
    try {
      await refreshAccount();
      if (state.account && isDeployed() && state.signer) {
        state.contract = new Contract(CONFIG.contractAddress, BOARD_ABI, state.signer);
      }
      renderConnectButton();
      renderNetworkNote();
    } catch (error) {
      console.error("Wallet detection failed", error);
    }
  } else if (!CONFIG.readRpcUrl) {
    els.statusLine.textContent =
      "No wallet detected in this browser. Connect a wallet to view drops.";
    renderDrops();
    return;
  }
  watchWalletEvents();
  await loadDrops();
}

els.connectBtn.addEventListener("click", onConnect);
init();
