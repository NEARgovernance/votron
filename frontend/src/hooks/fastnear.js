import * as near from "@fastnear/api";

window.near = near;
window.$$ = near.utils.convertUnit;

near.config({
  networkId: "testnet", // or "mainnet"
});

export function getNetworkId() {
  return near._config?.networkId || "testnet";
}

export { near };
