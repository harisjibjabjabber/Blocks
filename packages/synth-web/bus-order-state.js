export const BUS_GROUPS=Object.freeze(['sauce','harmonics','space']);
export const DEFAULT_BUS_ORDER=Object.freeze({version:1,order:BUS_GROUPS});
export function normalizeBusOrder(input=DEFAULT_BUS_ORDER){if(!input||input.version!==1||!Array.isArray(input.order)||input.order.length!==3||new Set(input.order).size!==3||input.order.some(x=>!BUS_GROUPS.includes(x)))throw Error('Invalid processor order');return{version:1,order:[...input.order]};}
export function toCoreBusOrder(input){const c=normalizeBusOrder(input);return{version:1,order:c.order.map(x=>BUS_GROUPS.indexOf(x))};}
