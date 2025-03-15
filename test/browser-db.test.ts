import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BrowserDB } from '../src/index';

describe('BrowserDB', () => {
  let db: BrowserDB;
  const TEST_DB_NAME = 'test-db';
  const TEST_TABLE_NAME = 'test-table';

  beforeEach(async () => {
    db = new BrowserDB(TEST_DB_NAME, 1);
    await db.open();
  });

  afterEach(() => {
    db.close();
  });

  describe('Database Operations', () => {
    it('should create a database instance', () => {
      expect(db).toBeInstanceOf(BrowserDB);
    });

    it('should open a database connection', async () => {
      const result = await db.open();
      expect(result).toBe(db);
    });

    it('should close a database connection', async () => {
      db.close();
      // This is an indirect test since we can't directly check if connection is closed
      // We'll verify by trying to perform an operation that should fail
      await expect(db.count(TEST_TABLE_NAME)).rejects.toThrow('Database not open');
    });

    it('should drop a database', async () => {
      await db.dropDatabase();
      // Verify by trying to use the dropped database
      await db.open(); // Should not throw after dropping
      expect(true).toBe(true); // If we reach here, the test passes
    });
  });

  describe('Table Operations', () => {
    it('should create a table', async () => {
      await db.createTable({
        name: TEST_TABLE_NAME,
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'name', keyPath: 'name' }
        ]
      });

      // Verify by inserting a record
      const id = await db.insert(TEST_TABLE_NAME, { name: 'Test' });
      expect(id).toBeDefined();
    });

    it('should drop a table', async () => {
      // First create a table
      await db.createTable({
        name: TEST_TABLE_NAME,
        keyPath: 'id',
        autoIncrement: true
      });

      // Then drop it
      await db.dropTable(TEST_TABLE_NAME);

      // Verify by trying to insert into the dropped table
      await expect(db.insert(TEST_TABLE_NAME, { name: 'Test' })).rejects.toThrow();
    });

    it('should clear a table', async () => {
      // Create table and insert data
      await db.createTable({
        name: TEST_TABLE_NAME,
        keyPath: 'id',
        autoIncrement: true
      });
      await db.insert(TEST_TABLE_NAME, { name: 'Test1' });
      await db.insert(TEST_TABLE_NAME, { name: 'Test2' });

      // Clear the table
      await db.clear(TEST_TABLE_NAME);

      // Verify table is empty
      const count = await db.count(TEST_TABLE_NAME);
      expect(count).toBe(0);
    });
  });

  describe('CRUD Operations', () => {
    interface TestRecord {
      id?: number;
      name: string;
      value?: number;
    }

    beforeEach(async () => {
      await db.createTable({
        name: TEST_TABLE_NAME,
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'name', keyPath: 'name' }
        ]
      });
    });

    it('should insert a record', async () => {
      const testData: TestRecord = { name: 'Test Record' };
      const id = await db.insert<TestRecord>(TEST_TABLE_NAME, testData);
      
      expect(id).toBeDefined();
      expect(typeof id).toBe('number');
    });

    it('should insert multiple records in batch', async () => {
      const testData: TestRecord[] = [
        { name: 'Batch Record 1' },
        { name: 'Batch Record 2' },
        { name: 'Batch Record 3' }
      ];
      
      const ids = await db.insert<TestRecord>(TEST_TABLE_NAME, testData);
      
      expect(Array.isArray(ids)).toBe(true);
      expect(Array.isArray(ids) ? ids.length : 1).toBe(3);
      expect(Array.isArray(ids) && ids.every(id => typeof id === 'number')).toBe(true);
      
      // Verify all records were inserted
      const records = await db.getAll<TestRecord>(TEST_TABLE_NAME);
      expect(records.length).toBe(3);
      expect(records.map(r => r.name)).toContain('Batch Record 1');
      expect(records.map(r => r.name)).toContain('Batch Record 2');
      expect(records.map(r => r.name)).toContain('Batch Record 3');
    });

    it('should get a record by key', async () => {
      const testData: TestRecord = { name: 'Test Get' };
      const id = await db.insert<TestRecord>(TEST_TABLE_NAME, testData);
      
      const record = await db.get<TestRecord>(TEST_TABLE_NAME, id);
      
      expect(record).not.toBeNull();
      expect(record?.name).toBe('Test Get');
      expect(record?.id).toBe(id);
    });

    it('should update a record', async () => {
      const testData: TestRecord = { name: 'Test Update', value: 10 };
      const id = await db.insert<TestRecord>(TEST_TABLE_NAME, testData);
      
      const updatedData: TestRecord = { id: id as number, name: 'Updated', value: 20 };
      await db.update<TestRecord>(TEST_TABLE_NAME, updatedData);
      
      const record = await db.get<TestRecord>(TEST_TABLE_NAME, id);
      
      expect(record?.name).toBe('Updated');
      expect(record?.value).toBe(20);
    });

    it('should update multiple records in batch', async () => {
      // Insert test records
      const testData1: TestRecord = { name: 'Batch Update 1', value: 10 };
      const testData2: TestRecord = { name: 'Batch Update 2', value: 20 };
      const testData3: TestRecord = { name: 'Batch Update 3', value: 30 };
      
      const id1 = await db.insert<TestRecord>(TEST_TABLE_NAME, testData1);
      const id2 = await db.insert<TestRecord>(TEST_TABLE_NAME, testData2);
      const id3 = await db.insert<TestRecord>(TEST_TABLE_NAME, testData3);
      
      // Update multiple records at once
      const updatedRecords: TestRecord[] = [
        { id: id1 as number, name: 'Updated 1', value: 100 },
        { id: id2 as number, name: 'Updated 2', value: 200 },
        { id: id3 as number, name: 'Updated 3', value: 300 }
      ];
      
      await db.update<TestRecord>(TEST_TABLE_NAME, updatedRecords);
      
      // Verify all records were updated
      const record1 = await db.get<TestRecord>(TEST_TABLE_NAME, id1);
      const record2 = await db.get<TestRecord>(TEST_TABLE_NAME, id2);
      const record3 = await db.get<TestRecord>(TEST_TABLE_NAME, id3);
      
      expect(record1?.name).toBe('Updated 1');
      expect(record1?.value).toBe(100);
      expect(record2?.name).toBe('Updated 2');
      expect(record2?.value).toBe(200);
      expect(record3?.name).toBe('Updated 3');
      expect(record3?.value).toBe(300);
    });

    it('should update records using query condition', async () => {
      // Insert test records
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Query Update 1', value: 10 });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Query Update 2', value: 10 });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Other Record', value: 20 });
      
      // Update records matching a condition
      await db.update<TestRecord>(
        TEST_TABLE_NAME, 
        { value: 10 }, // condition
        { value: 50, name: 'Updated Via Query' } // updates
      );
      
      // Verify records were updated
      const records = await db.getAll<TestRecord>(TEST_TABLE_NAME);
      const updatedRecords = records.filter(r => r.value === 50);
      const unchangedRecords = records.filter(r => r.value === 20);
      
      expect(updatedRecords.length).toBe(2);
      expect(updatedRecords.every(r => r.name === 'Updated Via Query')).toBe(true);
      expect(unchangedRecords.length).toBe(1);
      expect(unchangedRecords[0].name).toBe('Other Record');
    });

    it('should delete a record', async () => {
      const testData: TestRecord = { name: 'Test Delete' };
      const id = await db.insert<TestRecord>(TEST_TABLE_NAME, testData);
      
      await db.delete(TEST_TABLE_NAME, id);
      
      const record = await db.get<TestRecord>(TEST_TABLE_NAME, id);
      expect(record).toBeNull();
    });

    it('should delete multiple records in batch', async () => {
      // Insert test records
      const testData1: TestRecord = { name: 'Batch Delete 1' };
      const testData2: TestRecord = { name: 'Batch Delete 2' };
      const testData3: TestRecord = { name: 'Keep This Record' };
      
      const id1 = await db.insert<TestRecord>(TEST_TABLE_NAME, testData1);
      const id2 = await db.insert<TestRecord>(TEST_TABLE_NAME, testData2);
      const id3 = await db.insert<TestRecord>(TEST_TABLE_NAME, testData3);
      
      // Delete multiple records at once
      await db.delete(TEST_TABLE_NAME, [id1, id2]);
      
      // Verify records were deleted
      const record1 = await db.get<TestRecord>(TEST_TABLE_NAME, id1);
      const record2 = await db.get<TestRecord>(TEST_TABLE_NAME, id2);
      const record3 = await db.get<TestRecord>(TEST_TABLE_NAME, id3);
      
      expect(record1).toBeNull();
      expect(record2).toBeNull();
      expect(record3).not.toBeNull();
      expect(record3?.name).toBe('Keep This Record');
    });

    it('should delete records using query condition', async () => {
      // Insert test records
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Query Delete', value: 30 });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Also Query Delete', value: 30 });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Keep This One', value: 40 });
      
      // Delete records matching a condition
      await db.delete<TestRecord>(TEST_TABLE_NAME, { value: 30 });
      
      // Verify records were deleted
      const remainingRecords = await db.getAll<TestRecord>(TEST_TABLE_NAME);
      
      expect(remainingRecords.length).toBe(1);
      expect(remainingRecords[0].name).toBe('Keep This One');
      expect(remainingRecords[0].value).toBe(40);
    });

    it('should get all records', async () => {
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Record 1' });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Record 2' });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Record 3' });
      
      const records = await db.getAll<TestRecord>(TEST_TABLE_NAME);
      
      expect(records.length).toBe(3);
      expect(records.map(r => r.name)).toContain('Record 1');
      expect(records.map(r => r.name)).toContain('Record 2');
      expect(records.map(r => r.name)).toContain('Record 3');
    });

    it('should get records with pagination', async () => {
      for (let i = 1; i <= 10; i++) {
        await db.insert<TestRecord>(TEST_TABLE_NAME, { name: `Record ${i}` });
      }
      
      const page1 = await db.getAll<TestRecord>(TEST_TABLE_NAME, { limit: 3, offset: 0 });
      const page2 = await db.getAll<TestRecord>(TEST_TABLE_NAME, { limit: 3, offset: 3 });
      
      expect(page1.length).toBe(3);
      expect(page2.length).toBe(3);
      expect(page1[0].name).not.toBe(page2[0].name);
    });

    it('should count records', async () => {
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Record 1' });
      await db.insert<TestRecord>(TEST_TABLE_NAME, { name: 'Record 2' });
      
      const count = await db.count(TEST_TABLE_NAME);
      
      expect(count).toBe(2);
    });
  });

  describe('Query Operations', () => {
    interface TestUser {
      id?: number;
      name: string;
      age: number;
      active: boolean;
    }

    beforeEach(async () => {
      await db.createTable({
        name: TEST_TABLE_NAME,
        keyPath: 'id',
        autoIncrement: true,
        indexes: [
          { name: 'name', keyPath: 'name' },
          { name: 'age', keyPath: 'age' }
        ]
      });

      // Insert test data
      await db.insert<TestUser>(TEST_TABLE_NAME, { name: 'Alice', age: 25, active: true });
      await db.insert<TestUser>(TEST_TABLE_NAME, { name: 'Bob', age: 30, active: true });
      await db.insert<TestUser>(TEST_TABLE_NAME, { name: 'Charlie', age: 20, active: false });
      await db.insert<TestUser>(TEST_TABLE_NAME, { name: 'David', age: 35, active: true });
      await db.insert<TestUser>(TEST_TABLE_NAME, { name: 'Eve', age: 28, active: false });
    });

    it('should find records with simple equality condition', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { name: 'Alice' });
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Alice');
      expect(results[0].age).toBe(25);
    });

    it('should find records with $eq operator', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { age: { $eq: 30 } });
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Bob');
    });

    it('should find records with $gt operator', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { age: { $gt: 30 } });
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('David');
    });

    it('should find records with $gte operator', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { age: { $gte: 30 } });
      
      expect(results.length).toBe(2);
      expect(results.map(r => r.name)).toContain('Bob');
      expect(results.map(r => r.name)).toContain('David');
    });

    it('should find records with $lt operator', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { age: { $lt: 25 } });
      
      expect(results.length).toBe(1);
      expect(results[0].name).toBe('Charlie');
    });

    it('should find records with $lte operator', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { age: { $lte: 25 } });
      
      expect(results.length).toBe(2);
      expect(results.map(r => r.name)).toContain('Alice');
      expect(results.map(r => r.name)).toContain('Charlie');
    });

    it('should find records with $ne operator', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, { active: { $ne: true } });
      
      expect(results.length).toBe(2);
      expect(results.map(r => r.name)).toContain('Charlie');
      expect(results.map(r => r.name)).toContain('Eve');
    });

    it('should find records with multiple conditions', async () => {
      const results = await db.find<TestUser>(TEST_TABLE_NAME, {
        age: { $gte: 25 },
        active: true
      });
      
      expect(results.length).toBe(3);
      expect(results.map(r => r.name)).toContain('Alice');
      expect(results.map(r => r.name)).toContain('Bob');
      expect(results.map(r => r.name)).toContain('David');
    });

    it('should find records with pagination', async () => {
      const results = await db.find<TestUser>(
        TEST_TABLE_NAME, 
        { active: true },
        { limit: 2 }
      );
      
      expect(results.length).toBe(2);
    });
  });

  describe('Error Handling', () => {
    it('should throw error when trying to use closed database', async () => {
      db.close();
      await expect(db.insert(TEST_TABLE_NAME, { name: 'Test' })).rejects.toThrow('Database not open');
    });

    it('should throw error when trying to drop non-existent table', async () => {
      await expect(db.dropTable('non-existent-table')).rejects.toThrow('does not exist');
    });
  });

  describe('Join Operations', () => {
    interface User {
      id?: number;
      name: string;
      departmentId: number;
    }

    interface Department {
      id?: number;
      name: string;
      location: string;
    }

    beforeEach(async () => {
      // Create users table
      await db.createTable({
        name: 'users',
        keyPath: 'id',
        autoIncrement: true
      });

      // Create departments table
      await db.createTable({
        name: 'departments',
        keyPath: 'id',
        autoIncrement: true
      });

      // Insert test data
      await db.insert<Department>('departments', { name: 'Engineering', location: 'Building A' });
      await db.insert<Department>('departments', { name: 'Marketing', location: 'Building B' });
      await db.insert<Department>('departments', { name: 'Sales', location: 'Building C' });

      await db.insert<User>('users', { name: 'Alice', departmentId: 1 });
      await db.insert<User>('users', { name: 'Bob', departmentId: 1 });
      await db.insert<User>('users', { name: 'Charlie', departmentId: 2 });
      await db.insert<User>('users', { name: 'David', departmentId: 4 }); // No matching department
    });

    afterEach(async () => {
      await db.dropTable('users');
      await db.dropTable('departments');
    });

    it('should perform inner join between users and departments', async () => {
      const results = await db.innerJoin<User, Department>(
        'users',
        'departments',
        { leftKey: 'departmentId', rightKey: 'id' }
      );

      expect(results.length).toBe(3); // Only matched records
      expect(results[0].name).toBe('Alice');
      expect(results[0].location).toBe('Building A');
      expect(results.some(r => r.name === 'David')).toBe(false); // No unmatched records
    });

    it('should perform left join between users and departments', async () => {
      const results = await db.leftJoin<User, Department>(
        'users',
        'departments',
        { leftKey: 'departmentId', rightKey: 'id' }
      );

      expect(results.length).toBe(4); // All users, even unmatched
      expect(results.find(r => r.name === 'David')?.location).toBeUndefined();
      expect(results.filter(r => r.location === 'Building A').length).toBe(2);
    });

    it('should perform right join between users and departments', async () => {
      const results = await db.rightJoin<User, Department>(
        'users',
        'departments',
        { leftKey: 'departmentId', rightKey: 'id' }
      );

      expect(results.length).toBe(4); // All departments (3) + matched users
      expect(results.some(r => r.location === 'Building C' && !r.name)).toBe(true); // Department with no users
      expect(results.filter(r => r.location === 'Building A').length).toBe(2); // Two users in Engineering
    });

    it('should perform full join between users and departments', async () => {
      const results = await db.fullJoin<User, Department>(
        'users',
        'departments',
        { leftKey: 'departmentId', rightKey: 'id' }
      );

      expect(results.length).toBe(5); // All records from both tables
      expect(results.some(r => r.name === 'David' && !r.location)).toBe(true); // Unmatched user
      expect(results.some(r => r.location === 'Building C' && !r.name)).toBe(true); // Unmatched department
    });

    it('should handle join with pagination', async () => {
      const results = await db.join<User, Department>(
        'users',
        'departments',
        { leftKey: 'departmentId', rightKey: 'id' },
        { limit: 2 }
      );

      expect(results.length).toBe(2);
    });

    it('should handle empty result sets', async () => {
      await db.clear('users');
      
      const results = await db.innerJoin<User, Department>(
        'users',
        'departments',
        { leftKey: 'departmentId', rightKey: 'id' }
      );

      expect(results.length).toBe(0);
    });
  });
});