export function formatSseMessage(event: string, data: string): string {
  return `event: ${event}\ndata: ${data}\n\n`;
}
