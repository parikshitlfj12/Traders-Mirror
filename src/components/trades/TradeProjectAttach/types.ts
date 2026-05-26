export interface AttachableProjectOption {
  readonly id: string;
  readonly name: string;
}

export interface TradeProjectAttachProps {
  readonly tradeId: string;
  readonly disabled?: boolean;
}

export interface TradeProjectAttachResponse {
  data?: { trade: { id: string; projectId: string | null } };
  error?: { message: string; code?: string };
}
