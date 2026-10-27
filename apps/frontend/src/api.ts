export interface Lead {
  name: string;
  contact: string;
  message: string;
}

interface ApiError {
  message: string;
  details?: { leadId?: unknown };
}

/**
 * Ошибка отправки лида. leadId приходит, когда gateway уже присвоил лиду id:
 * повтор с тем же id дедуплицируется в каналах, которые лид уже приняли.
 */
export class SendLeadError extends Error {
  constructor(
    message: string,
    readonly leadId: string | undefined,
  ) {
    super(message);
  }
}

export async function sendLead(lead: Lead, id?: string): Promise<void> {
  const response = await fetch('/api/v1/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...lead, id }),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    if (!isApiError(body)) {
      throw new SendLeadError(`Request failed with status ${String(response.status)}`, undefined);
    }

    const leadId = body.error.details?.leadId;
    throw new SendLeadError(body.error.message, typeof leadId === 'string' ? leadId : undefined);
  }
}

function isApiError(body: unknown): body is { error: ApiError } {
  return (
    typeof body === 'object' &&
    body !== null &&
    'error' in body &&
    typeof body.error === 'object' &&
    body.error !== null &&
    'message' in body.error
  );
}
