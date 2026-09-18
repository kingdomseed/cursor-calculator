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
    expect(html).toContain('Official Cursor pages disagree on Other Models dollars.');
    expect(html).toContain('https://cursor.com/help/account-and-billing/pricing');
    expect(html).toContain('https://cursor.com/docs/models-and-pricing');
    expect(html).toContain('still show included Other Models usage as Pro at least $20, Pro+ $70, and Ultra $400.');
    expect(html).toContain('The live billing HTML no longer prints those amounts.');
    expect(html).toContain('says only Included.');
    expect(html).toContain('This calculator does not pick a winner.');
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
