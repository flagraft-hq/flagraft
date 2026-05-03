export interface ServerErrorBody {
  error: string
  message: string
  statusCode: number
}

export class FlagraftError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'FlagraftError'
  }
}
