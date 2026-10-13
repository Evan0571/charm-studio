import type { DesignConfig } from './types';

export function designSignature(config: DesignConfig, name: string) {
  return JSON.stringify([{
    templateId: config.templateId,
    connectorId: config.connectorId,
    cordColor: config.cordColor,
    metalTone: config.metalTone,
    slots: Object.fromEntries(Object.entries(config.slots).sort(([a], [b]) => a.localeCompare(b))),
    lockedSlots: [...config.lockedSlots].sort(),
  }, name.trim()]);
}
