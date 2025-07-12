let allowRegistration = false;
const wsClients = new Map<string, WebSocket>();

export { allowRegistration, wsClients };
export function setAllowRegistration(value: boolean): void {
  allowRegistration = value;
}
