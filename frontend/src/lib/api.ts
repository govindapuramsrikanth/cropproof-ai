const configuredApiUrl = import.meta.env.VITE_API_URL?.trim().replace(/\/+$/, '')

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return configuredApiUrl ? `${configuredApiUrl}${normalizedPath}` : normalizedPath
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const requestInput =
    typeof input === 'string' && input.startsWith('/')
      ? apiUrl(input)
      : input
  const response = await fetch(requestInput, init)
  if (!response.ok) {
    const responseText = await response.text()
    let message = responseText || `Request failed with status ${response.status}`
    if (responseText) {
      try {
        const payload: unknown = JSON.parse(responseText)
        if (
          typeof payload === 'object' &&
          payload !== null &&
          'detail' in payload &&
          typeof payload.detail === 'string'
        ) {
          message = payload.detail
        }
      } catch (error) {
        if (!(error instanceof SyntaxError)) throw error
      }
    }
    throw new Error(message)
  }
  return (await response.json()) as T
}

export function jsonRequest(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }
}
