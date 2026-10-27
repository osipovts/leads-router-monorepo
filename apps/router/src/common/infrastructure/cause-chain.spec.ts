import { causeChain } from './cause-chain';

describe('causeChain', () => {
  it('yields the error and each nested cause in order', (): void => {
    const root = new Error('root');
    const middle = new Error('middle', { cause: root });
    const top = new Error('top', { cause: middle });

    expect([...causeChain(top)]).toEqual([top, middle, root]);
  });

  it('stops at the first non-object cause', (): void => {
    const top = new Error('top', { cause: 'string cause' });

    expect([...causeChain(top)]).toEqual([top]);
  });

  it('yields nothing for a non-object error', (): void => {
    expect([...causeChain('failure')]).toEqual([]);
    expect([...causeChain(null)]).toEqual([]);
  });

  it('terminates on a cyclic cause chain', (): void => {
    const first: { cause?: unknown } = {};
    const second: { cause?: unknown } = { cause: first };
    first.cause = second;

    expect([...causeChain(first)]).toEqual([first, second]);
  });
});
