import { PartArt } from '../CharmArt';
import type { Part } from '../../shared/types';
import images from './partImages.generated';

export function PartImage({part, metalTone}: {part: Part; metalTone: string}) {
  const src = (images as Record<string, string>)[part.id];
  return src ? <img src={src} alt="" loading="lazy" decoding="async"/> : <PartArt part={part} metalTone={metalTone}/>;
}
