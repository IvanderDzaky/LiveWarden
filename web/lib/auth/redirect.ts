export function getSafeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/dashboard';

  try {
    const url = new URL(value, 'http://livewarden.invalid');
    return url.origin === 'http://livewarden.invalid' ? `${url.pathname}${url.search}${url.hash}` : '/dashboard';
  } catch {
    return '/dashboard';
  }
}
