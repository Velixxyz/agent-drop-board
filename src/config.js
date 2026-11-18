/**
 * Deployment seam: everything environment-specific lives here.
 *
 * CONTRACT_ADDRESS is intentionally the zero address until the contract is
 * deployed (deployment needs lokie's explicit approval on a preview first).
 * After deployment, set it to the deployed AgentDropBoard address and the
 * frontend starts reading live drops. No other file needs to change.
 */
export const CONFIG = {
  /** Deployed AgentDropBoard address (BSC mainnet, deployed 18 Nov 2026). */
  contractAddress: "0x027654e0DD61CcDFb7c4cb53Cd7E5cf9d310196c",

  /** BNB Smart Chain mainnet. */
  chainId: 56,
  chainHex: "0x38",
  chainName: "BNB Smart Chain",

  /**
   * Optional public read-only RPC used to show drops to visitors who have no
   * wallet installed. Leave empty to require an injected wallet for reads.
   * Never put an API key here; only a plain public endpoint, if any.
   */
  readRpcUrl: "https://bsc-dataseed.binance.org",

  /** Safety cap on how many drops the list will scan from the contract. */
  maxDropsToScan: 50,
};

/** Minimal ABI: only what the board UI needs. */
export const BOARD_ABI = [
  "function nextDropId() view returns (uint256)",
  "function drops(uint256) view returns (string name, uint256 maxSupply, uint256 minted, bool active)",
  "function remaining(uint256 dropId) view returns (uint256)",
  "function hasClaimed(uint256 dropId, address claimer) view returns (bool)",
  "function claim(uint256 dropId) payable returns (uint256)",
  "function AGENT_ID_REGISTRY() view returns (address)",
  "error NotAgentIdHolder()",
  "error AlreadyClaimed()",
  "error DropNotFound()",
  "error DropInactive()",
  "error SupplyExhausted()",
  "error ValueNotAccepted()",
  "error InvalidDrop()",
  "event Claimed(address indexed claimer, uint256 indexed dropId, uint256 indexed tokenId)",
];

/** Friendly explanations for contract revert reasons. */
export const REVERT_MESSAGES = {
  NotAgentIdHolder:
    "This wallet does not hold an Agent ID, so the contract rejected the claim.",
  AlreadyClaimed: "This wallet already claimed this drop. One badge per drop.",
  DropNotFound: "That drop does not exist.",
  DropInactive: "This drop is not accepting claims right now.",
  SupplyExhausted: "This drop is sold out.",
  ValueNotAccepted: "Claims are free; the contract rejects any payment.",
};
