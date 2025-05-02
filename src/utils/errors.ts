/**
 * Custom error classes for DDP server.
 */
export class DDPConnectionError extends Error {
  public code: number;
  public details: Record<string, any>;

  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'DDPConnectionError';
    this.code = 1000;
    this.details = details;
  }
}

export class DDPProtocolError extends Error {
  public code: number;
  public details: Record<string, any>;

  constructor(message: string, details: Record<string, any> = {}) {
    super(message);
    this.name = 'DDPProtocolError';
    this.code = 1001;
    this.details = details;
  }
}
