// SQLite database manager for saved destinations
import * as SQLite from 'expo-sqlite';
import { Destination } from '../types';

export interface DatabaseManager {
  initializeDatabase(): Promise<void>;
  saveDestination(destination: Destination): Promise<string>;
  getSavedDestinations(): Promise<Destination[]>;
  deleteDestination(id: string): Promise<void>;
  updateDestination(id: string, updates: Partial<Destination>): Promise<void>;
  searchDestinations(query: string): Promise<Destination[]>;
}

class DatabaseManagerImpl implements DatabaseManager {
  private db: SQLite.SQLiteDatabase | null = null;

  async initializeDatabase(): Promise<void> {
    try {
      this.db = await SQLite.openDatabaseAsync('hopoff.db');
      
      await this.db.execAsync(`
        CREATE TABLE IF NOT EXISTS destinations (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          address TEXT,
          createdAt TEXT NOT NULL
        );
        
        CREATE INDEX IF NOT EXISTS idx_destinations_name ON destinations(name);
        CREATE INDEX IF NOT EXISTS idx_destinations_created ON destinations(createdAt);
      `);
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async saveDestination(destination: Destination): Promise<string> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    try {
      await this.db!.runAsync(
        `INSERT OR REPLACE INTO destinations 
         (id, name, latitude, longitude, address, createdAt) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          destination.id,
          destination.name,
          destination.coordinate.latitude,
          destination.coordinate.longitude,
          destination.address || null,
          typeof destination.createdAt === 'string' ? destination.createdAt : new Date(destination.createdAt).toISOString()
        ]
      );

      return destination.id;
    } catch (error) {
      throw new Error(`Failed to save destination: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async getSavedDestinations(): Promise<Destination[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    try {
      const result = await this.db!.getAllAsync(
        'SELECT * FROM destinations ORDER BY createdAt DESC'
      );

      return result.map(this.mapRowToDestination);
    } catch (error) {
      throw new Error(`Failed to get saved destinations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async deleteDestination(id: string): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    try {
      await this.db!.runAsync('DELETE FROM destinations WHERE id = ?', [id]);
    } catch (error) {
      throw new Error(`Failed to delete destination: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async updateDestination(id: string, updates: Partial<Destination>): Promise<void> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    try {
      const setParts: string[] = [];
      const values: any[] = [];

      if (updates.name !== undefined) {
        setParts.push('name = ?');
        values.push(updates.name);
      }
      if (updates.coordinate !== undefined) {
        setParts.push('latitude = ?, longitude = ?');
        values.push(updates.coordinate.latitude, updates.coordinate.longitude);
      }
      if (updates.address !== undefined) {
        setParts.push('address = ?');
        values.push(updates.address);
      }

      if (setParts.length === 0) {
        return; // No updates to make
      }

      values.push(id);
      const query = `UPDATE destinations SET ${setParts.join(', ')} WHERE id = ?`;
      
      await this.db!.runAsync(query, values);
    } catch (error) {
      throw new Error(`Failed to update destination: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async searchDestinations(query: string): Promise<Destination[]> {
    if (!this.db) {
      await this.initializeDatabase();
    }

    try {
      const searchQuery = `%${query.toLowerCase()}%`;
      const result = await this.db!.getAllAsync(
        `SELECT * FROM destinations 
         WHERE LOWER(name) LIKE ? OR LOWER(address) LIKE ?
         ORDER BY createdAt DESC`,
        [searchQuery, searchQuery]
      );

      return result.map(this.mapRowToDestination);
    } catch (error) {
      throw new Error(`Failed to search destinations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private mapRowToDestination(row: any): Destination {
    return {
      id: row.id,
      name: row.name,
      coordinate: {
        latitude: row.latitude,
        longitude: row.longitude,
      },
      address: row.address || undefined,
      createdAt: row.createdAt,
    };
  }
}

// Export singleton instance
export const databaseManager = new DatabaseManagerImpl();