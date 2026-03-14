import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('renders all three nav items', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('I have a budget');
    expect(html).toContain('I know my usage');
    expect(html).toContain('I have a CSV');
  });

  it('renders app branding', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('Cursor Cost Calculator');
  });

  it('renders the full footer content including explanatory text and disclaimer', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('two usage pools');
    expect(html).toContain('Max Mode');
    expect(html).toContain('Disclaimer');
    expect(html).toContain('2026-03-12');
    expect(html).toContain('GitHub');
  });

  it('includes navigation landmark with accessible label', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    // <nav> is an implicit navigation landmark; aria-label is on the <nav> element
    expect(html).toContain('<nav aria-label="Calculator mode"');
  });
});
