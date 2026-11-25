export interface BorderPayEmbedOptions {
  reference: string;
  onSuccess?: (msg?: { returnUrl?: string; [key: string]: unknown }) => void;
  onClose?: () => void;
}

declare global {
  interface Window {
    BorderPay?: {
      checkout: (options: BorderPayEmbedOptions) => void;
    };
  }
}

export {};
