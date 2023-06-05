import { UniqueStatusPipe, StatusesPipe } from '../status.pipes';

describe('UniqueStatusPipe', () => {
  let pipe: UniqueStatusPipe;

  beforeEach(() => {
    pipe = new UniqueStatusPipe();
  });

  it('should return the value for the specified status in the map', () => {
    const statusMap = new Map<string, number>([
      ['ACTIVE', 1],
      ['INACTIVE', 2],
    ]);
    expect(pipe.transform(statusMap, 'ACTIVE')).toBe(1);
  });

  it('should return undefined if the status is not in the map', () => {
    const statusMap = new Map<string, number>([
      ['ACTIVE', 1],
      ['INACTIVE', 2],
    ]);
    expect(pipe.transform(statusMap, 'PENDING')).toBeUndefined();
  });

  it('should work with different types for the status and the value in the map', () => {
    const statusMap = new Map<number, string>([
      [1, 'ACTIVE'],
      [2, 'INACTIVE'],
    ]);
    expect(pipe.transform(statusMap, 1)).toBe('ACTIVE');
  });
});

describe('StatusesPipe', () => {
  let pipe: StatusesPipe;

  beforeEach(() => {
    pipe = new StatusesPipe();
  });

  it('should return false if statuses is empty', () => {
    expect(pipe.transform(new Map(), 'item', 'status')).toBe(false);
  });

  it('should return false if item is not in statuses', () => {
    const statuses = new Map<string, Set<string>>([
      ['item1', new Set(['status1'])],
      ['item2', new Set(['status1', 'status2'])],
    ]);
    expect(pipe.transform(statuses, 'item3', 'status1')).toBe(false);
  });

  it('should return false if status is not in statuses for item', () => {
    const statuses = new Map<string, Set<string>>([
      ['item1', new Set(['status1'])],
      ['item2', new Set(['status1', 'status2'])],
    ]);
    expect(pipe.transform(statuses, 'item2', 'status3')).toBe(false);
  });

  it('should return true if status is in statuses for item', () => {
    const statuses = new Map<string, Set<string>>([
      ['item1', new Set(['status1'])],
      ['item2', new Set(['status1', 'status2'])],
    ]);
    expect(pipe.transform(statuses, 'item2', 'status1')).toBe(true);
  });
});

