import { resolveVersion, useSyncStore } from '@/stores/sync';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

describe('resolveVersion', () => {
  beforeEach(() => useSyncStore.setState({ versionChain: {} }));

  it('returns the base version when this device has not saved the record since', () => {
    expect(resolveVersion('application:1:ApplicantInfo', 3)).toBe('3');
  });

  it('follows the versions produced by this device’s own queued saves, in order', () => {
    const { recordVersion } = useSyncStore.getState();
    // Two edits were queued offline, both based on version 1.
    recordVersion('property:a', 'v1', 'v2'); // the first replayed save turned v1 into v2
    expect(resolveVersion('property:a', 'v1')).toBe('v2');

    recordVersion('property:a', 'v2', 'v3');
    expect(resolveVersion('property:a', 'v1')).toBe('v3');
  });

  it('keeps the stale version when an earlier save was rejected, so the later one is rejected too', () => {
    // Nothing was recorded because the first save failed with a conflict.
    expect(resolveVersion('unit:b', 'v1')).toBe('v1');
  });

  it('does not loop on a malformed chain', () => {
    useSyncStore.setState({ versionChain: { 'unit:c': { '1': '2', '2': '1' } } });
    expect(['1', '2']).toContain(resolveVersion('unit:c', '1'));
  });
});
