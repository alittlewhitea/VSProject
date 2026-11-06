// Temporarily pause new Dodo purchases while its merchant review is unresolved.
// Keep credentials, historical payment sync, and verified webhooks available.
// Set to false in a reviewed release when the payment method can reopen.
export const DODO_CHECKOUT_SUSPENDED = true;
