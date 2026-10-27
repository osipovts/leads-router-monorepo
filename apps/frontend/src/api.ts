export interface Lead {
  name: string;
  contact: string;
  message: string;
}

interface ApiError {
  message: string;
}

export async function sendLead(lead: Lead, id: string): Promise<void> {
  const response = await fetch('/api/v1/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, id }),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (!isApiError(body)) {
      throw new Error(`Request failed with status ${String(response.status)}`);
    }

    throw new Error(body.error.message);
  }
}

function isApiError(body: unknown): body is { error: ApiError } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error &&
    typeof body.error.message === 'string'
  );
}
