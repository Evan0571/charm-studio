import { designSignature } from '../../shared/designState';
import type { Language } from '../../shared/localization';
import type { Catalog, DesignConfig, Quote, Order, SavedDesign } from '../../shared/types';

export type Preview = { name: string; config: DesignConfig; quote: Quote; catalog: Catalog; designId?: string; selectionSlot?: string; savedSignature?: string };
export type Checkout = { confirmationToken: string; designName: string; config: DesignConfig; quote: Quote; expiresAt: string; notice: string };

export function isSaved(preview: Preview) {
  return !!preview.designId && preview.savedSignature === designSignature(preview.config, preview.name);
}

export function reconcileSavedDesign(preview: Preview, design: SavedDesign): Preview {
  if (preview.designId !== design.id) return preview;
  const savedSignature = designSignature(design.config, design.name);
  return savedSignature === preview.savedSignature ? preview : {...preview, savedSignature};
}

export function modelContext(preview: Preview, language: Language, checkout?: Checkout, order?: Order) {
  return {
    name: preview.name, config: preview.config, quote: preview.quote, designId: preview.designId,
    language, saveStatus: isSaved(preview) ? 'saved' : preview.designId ? 'modified' : 'unsaved',
    ...(checkout ? { checkout: { designName: checkout.designName, config: checkout.config, quote: checkout.quote, expiresAt: checkout.expiresAt, requiresConfirmation: true } } : {}),
    ...(order ? { order } : {}), testOrdersOnly: true,
  };
}

export function checkoutExpired(checkout: Checkout, now = Date.now()) {
  const expiresAt = Date.parse(checkout.expiresAt);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
