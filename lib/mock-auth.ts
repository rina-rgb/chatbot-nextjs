// TEMPORARY: Mock authentication for MVP development
// This file provides a mock session when authentication is disabled

import type { Session } from 'next-auth';
import type { UserType } from '@/app/(auth)/auth';
import { getUser, createGuestUser } from '@/lib/db/queries';

export function createMockSession(): Session {
  return {
    user: {
      id: 'mock-user-id',
      email: 'guest-123',
      name: 'Guest User',
      type: 'guest' as UserType,
    },
    expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
  };
}

export function createMockAuth() {
  return async (): Promise<Session | null> => {
    // Check if the mock user exists, create if not
    const users = await getUser('guest-123');
    if (users.length === 0) {
      console.log('Creating mock user in database...');
      // Create a user with the specific email we're looking for
      const { createUser } = await import('@/lib/db/queries');
      const { generateUUID } = await import('@/lib/utils');
      const newUser = await createUser('guest-123', generateUUID());
      console.log('✅ Mock user created:', newUser);
    }
    
    // Get the actual user from the database
    const actualUsers = await getUser('guest-123');
    if (actualUsers.length > 0) {
      const actualUser = actualUsers[0];
      return {
        user: {
          id: actualUser.id,
          email: actualUser.email,
          name: 'Guest User',
          type: 'guest' as UserType,
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
      };
    }
    
    return createMockSession();
  };
} 