import { getCurrentDate, getCurrentISOString, isMockDateActive } from './date.util';

describe('Date Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getCurrentDate', () => {
    it('should return real date in production even with MOCK_DATE set', () => {
      process.env.NODE_ENV = 'production';
      process.env.MOCK_DATE = '2026-04-01';

      const date = getCurrentDate();
      const now = new Date();

      // Should be close to real date (within 1 second)
      expect(Math.abs(date.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it('should return real date when NODE_ENV is not development', () => {
      process.env.NODE_ENV = 'test';
      process.env.MOCK_DATE = '2026-04-01';

      const date = getCurrentDate();
      const now = new Date();

      expect(Math.abs(date.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it('should return mocked date in development mode', () => {
      process.env.NODE_ENV = 'development';
      process.env.MOCK_DATE = '2026-04-01';

      const date = getCurrentDate();
      const expected = new Date('2026-04-01');

      // Should be exactly the mocked date
      expect(date.toISOString().split('T')[0]).toBe('2026-04-01');
    });

    it('should return real date in development without MOCK_DATE', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.MOCK_DATE;

      const date = getCurrentDate();
      const now = new Date();

      expect(Math.abs(date.getTime() - now.getTime())).toBeLessThan(1000);
    });

    it('should return real date with invalid MOCK_DATE format', () => {
      process.env.NODE_ENV = 'development';
      process.env.MOCK_DATE = 'invalid-date';

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      const date = getCurrentDate();
      const now = new Date();

      expect(Math.abs(date.getTime() - now.getTime())).toBeLessThan(1000);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('isMockDateActive', () => {
    it('should return false in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.MOCK_DATE = '2026-04-01';

      expect(isMockDateActive()).toBe(false);
    });

    it('should return true in development with valid MOCK_DATE', () => {
      process.env.NODE_ENV = 'development';
      process.env.MOCK_DATE = '2026-04-01';

      expect(isMockDateActive()).toBe(true);
    });

    it('should return false in development without MOCK_DATE', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.MOCK_DATE;

      expect(isMockDateActive()).toBe(false);
    });
  });
});
