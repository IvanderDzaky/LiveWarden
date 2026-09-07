import { FakeCollector } from '../collectors/fake.js';
import { TikTokCollector } from '../collectors/tiktok.js';
import type { Collector } from '../domain/collector.js';

export const createCollector = (provider: 'fake' | 'tiktok', options: ConstructorParameters<typeof TikTokCollector>[0] = {}): Collector =>
  provider === 'tiktok' ? new TikTokCollector(options) : new FakeCollector();
