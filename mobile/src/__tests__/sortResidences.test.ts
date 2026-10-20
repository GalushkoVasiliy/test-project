import { sortResidences } from '@/query/mutations';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
jest.mock('expo-secure-store', () => ({}));

const residence = (id: string, moveOutDate: string | null) => ({
  id,
  address: null,
  landlordName: null,
  landlordPhone: null,
  moveInDate: null,
  moveOutDate,
});

it('orders residences like the server: latest move-out first, undated last, then by id', () => {
  const sorted = sortResidences([
    residence('b', null),
    residence('c', '2021-01-01'),
    residence('a', null),
    residence('d', '2024-05-01'),
  ]);
  expect(sorted.map((r) => r.id)).toEqual(['d', 'c', 'a', 'b']);
});
