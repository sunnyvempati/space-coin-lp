export const SPACE_ROUTER_ADDRESS = "0x7dce2D748675a0839d4e38A9eB65329c324b2BFE";
export const SPACE_COIN_ADDRESS = "0xB432592ef054EBC7f51F02492Ef1E228c8736bA0";
export const SPACE_COIN_LP_ADDRESS = "0x9b8cA508f686E395AFBb1c489Bd880880271FC39";

// 1 day from now
export const DEADLINE = Date.now() + 60 * 60 * 24;
export const formatToDecimal = (amount: string | undefined) => amount && parseFloat(amount).toFixed(3).toString();
