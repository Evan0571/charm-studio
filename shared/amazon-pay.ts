import type { Order } from './types';

export interface AmazonPayButtonConfig {
  merchantId: string;
  publicKeyId: string;
  ledgerCurrency: 'USD';
  checkoutLanguage: 'en_US';
  productType: 'PayOnly';
  placement: 'Checkout';
  buttonColor: 'Gold';
  sandbox: true;
  createCheckoutSessionConfig: {
    payloadJSON: string;
    signature: string;
    algorithm: 'AMZN-PAY-RSASSA-PSS-V2';
  };
}

export interface AmazonPayStatus { configured: boolean; environment: 'sandbox'; }
export interface AmazonPayPreparedCheckout { order: Order; button: AmazonPayButtonConfig; }
