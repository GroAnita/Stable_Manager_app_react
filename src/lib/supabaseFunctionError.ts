// A failed Edge Function call hides the function's own message in the response
// body, so read it out to show something more useful than a generic error.
export async function supabaseFunctionError(error: Error): Promise<Error> {
  const context = (error as { context?: Response }).context
  if (!context) return error
  try {
    const body = await context.clone().json()
    if (typeof body?.error === 'string') return new Error(body.error)
  } catch {
    // The body wasn't JSON, so fall back to the original error.
  }
  return error
}
