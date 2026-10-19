/**
 * PaymentGatewayAdapter.ts
 * Clean Architecture Abstraction Layer for Payment Gateway Integration
 * 
 * Conforms to the enterprise design pattern where vendor-specific logic is fully isolated.
 * To integrate with live production servers in the future, developers only need to swap the implementation 
 * of generatePaymentLink with the actual Axios/SDK calls to Midtrans, Mayar, or Doku.
 */

export type PaymentProvider = 'MIDTRANS' | 'MAYAR' | 'DOKU';

export interface ClientDetails {
  name: string;
  email: string;
  phone: string;
}

export interface PaymentGatewayResponse {
  success: boolean;
  paymentLink: string;
  provider: PaymentProvider;
  transactionId: string;
  expiryTime: string; // Long TTL (Time-to-Live)
  meta: {
    sandbox: boolean;
    providerReference: string;
  };
}

export const PaymentGatewayAdapter = {
  /**
   * Generates a payment link from the selected provider.
   * Includes custom payload configuration mimicking the real-world payloads of Midtrans, Mayar, and Doku.
   */
  async generatePaymentLink(
    invoiceId: string,
    amount: number,
    clientDetails: ClientDetails,
    provider: PaymentProvider
  ): Promise<PaymentGatewayResponse> {
    // Simulate slight network latency (500ms)
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Expiry date calculation: e.g. 180 Days TTL (Long TTL as requested)
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + 180);
    const expiryString = expiry.toISOString();

    const cleanInvoiceId = invoiceId.replace(/[^a-zA-Z0-9-]/g, '');
    const transactionId = `${provider.toLowerCase()}-tx-${Math.random().toString(36).substr(2, 9)}`;

    let paymentLink = '';

    switch (provider) {
      case 'MIDTRANS':
        // Real Midtrans snap URL: https://app.sandbox.midtrans.com/snap/v2/vtweb/...
        paymentLink = `https://pay.notaris.io/mock-pg/midtrans/inv-${cleanInvoiceId}?tx=${transactionId}&ttl=180d`;
        break;

      case 'MAYAR':
        // Real Mayar URL: https://pub.mayar.id/pay/...
        paymentLink = `https://pay.notaris.io/mock-pg/mayar/inv-${cleanInvoiceId}?tx=${transactionId}&ttl=180d`;
        break;

      case 'DOKU':
        // Real Doku Jokul link
        paymentLink = `https://pay.notaris.io/mock-pg/doku/inv-${cleanInvoiceId}?tx=${transactionId}&ttl=180d`;
        break;

      default:
        throw new Error(`Unsupported payment provider: ${provider}`);
    }

    return {
      success: true,
      paymentLink,
      provider,
      transactionId,
      expiryTime: expiryString,
      meta: {
        sandbox: true,
        providerReference: `REF-${provider.toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`,
      }
    };
  }
};
