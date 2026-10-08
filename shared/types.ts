export type TemplateId = 'cord' | 'chain' | 'hero';
export type MetalTone = 'gold' | 'silver';
export type PartCategory = 'bead' | 'charm';
export interface Part { id: string; name: string; category: PartCategory; price: number; color: string; shape: string; material: string; tags: string[]; }
export interface Slot { id: string; name: string; categories: PartCategory[]; }
export interface Template { id: TemplateId; name: string; subtitle: string; description: string; basePrice: number; slots: Slot[]; connectorIds: string[]; }
export interface Connector { id: string; name: string; price: number; }
export interface Catalog { templates: Template[]; parts: Part[]; connectors: Connector[]; cordColors: {id:string;name:string;hex:string}[]; currency: 'CNY'; }
export interface DesignConfig { templateId: TemplateId; connectorId: string; cordColor: string; metalTone: MetalTone; slots: Record<string,string|null>; lockedSlots: string[]; }
export interface Quote { lines: {id:string;name:string;quantity:number;unitPrice:number;subtotal:number}[]; total: number; currency:'CNY'; }
export interface SavedDesign { id:string; name:string; config:DesignConfig; createdAt:string; updatedAt:string; }
export interface Order { id:string; designName:string; config:DesignConfig; quote:Quote; status:'test_confirmed'; createdAt:string; }
