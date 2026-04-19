export function getApiUrl(): string {
  if (typeof window !== 'undefined' && (window as any).__ENV__?.NEXT_PUBLIC_API_URL) {
    return (window as any).__ENV__.NEXT_PUBLIC_API_URL as string;
  }
  return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';
}

export function getApiBase(): string {
  return getApiUrl().replace(/\/api$/, '');
}
