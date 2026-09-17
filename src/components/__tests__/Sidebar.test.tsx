import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Sidebar } from '../Sidebar';

describe('Sidebar', () => {
  it('renders all calculator nav items', () => {
    const html = renderToStaticMarkup(
      <Sidebar activeTarget="budget" onNavigate={vi.fn()} pricingDate="2026-03-12" />,
    );
    expect(html).toContain('I have a budget');
    expect(html).toContain('I know my usage');
    expect(html).toContain('I have a CSV');
    expect(html).toContain('Cloud and automations');
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
    expect(html).toContain('Cursor Models');
    expect(html).toContain('Other Models');
    expect(html).toContain('Ultra used to include $400 on a $200 plan; you may not get that now.');
    expect(html).toContain('not current guaranteed included dollars');
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
