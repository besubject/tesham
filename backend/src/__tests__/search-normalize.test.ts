import { buildSearchTokenVariants } from '../utils/search-normalize';

describe('buildSearchTokenVariants', () => {
  it('builds transliteration variants for cyrillic names', () => {
    const token = buildSearchTokenVariants('Амина')[0]!;
    expect(token.rawVariants).toContain('амина');
    expect(token.latinVariants).toContain('amina');
  });

  it('builds transliteration variants for latin names', () => {
    const token = buildSearchTokenVariants('Amina')[0]!;
    expect(token.rawVariants).toContain('amina');
    expect(token.latinVariants).toContain('amina');
  });

  it('builds wrong-layout variants', () => {
    const token = buildSearchTokenVariants('фьштф')[0]!;
    expect(token.rawVariants).toContain('amina');
    expect(token.latinVariants).toContain('amina');
  });

  it('splits query into keyword tokens', () => {
    const tokens = buildSearchTokenVariants('салон амина');

    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.rawVariants).toContain('салон');
    expect(tokens[1]?.latinVariants).toContain('amina');
  });
});
