import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MI_ETB_STORE_LINKS, StoreBadges } from './StoreBadges';

describe('StoreBadges', () => {
  it('redirige a la app Mi ETB en cada tienda configurada', () => {
    render(<StoreBadges />);

    expect(screen.getByRole('link', { name: /App Store/i })).toHaveAttribute('href', MI_ETB_STORE_LINKS.appStore);
    expect(screen.getByRole('link', { name: /Google Play/i })).toHaveAttribute('href', MI_ETB_STORE_LINKS.googlePlay);
    expect(screen.getByRole('link', { name: /AppGallery/i })).toHaveAttribute('href', MI_ETB_STORE_LINKS.appGallery);
  });
});
