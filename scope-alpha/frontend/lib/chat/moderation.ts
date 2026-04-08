/**
 * Chat moderation helpers — Phase 6.
 *
 * Resolves a user's role in a room (member / muted / banned), auto-unmutes
 * expired temporary mutes by deleting the row, and exposes a `canPost`
 * gate used by the chat POST handler.
 *
 * "Room owner" semantics: Phase 6 currently uses `roomId === analystId`
 * (the existing convention from the mock chat). The owner is therefore
 * the user whose `id === roomId`. This may evolve in the future to a
 * proper Room model, but for now this assumption holds across all routes.
 */

import { prisma } from '@/lib/prisma';

export type MemberRole = 'member' | 'muted' | 'banned';

export interface MemberState {
  role: MemberRole;
  mutedUntil: Date | null;
  bannedAt: Date | null;
  reason: string | null;
}

const NEUTRAL_MEMBER: MemberState = {
  role: 'member',
  mutedUntil: null,
  bannedAt: null,
  reason: null,
};

/**
 * Returns the current member state for a user in a room.
 *
 * Side effect: if the user has an expired temporary mute, the row is
 * upserted back to `'member'` so subsequent calls return the resolved state.
 */
export async function getMemberState(
  roomId: string,
  userId: string,
): Promise<MemberState> {
  // The room owner is always a member with no restrictions.
  if (roomId === userId) {
    return NEUTRAL_MEMBER;
  }

  const row = await prisma.chatRoomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (!row) return NEUTRAL_MEMBER;

  if (row.role === 'banned') {
    return {
      role: 'banned',
      mutedUntil: null,
      bannedAt: row.bannedAt,
      reason: row.reason,
    };
  }

  if (row.role === 'muted') {
    // Expired temporary mute → auto-unmute.
    if (row.mutedUntil && row.mutedUntil < new Date()) {
      await prisma.chatRoomMember
        .update({
          where: { roomId_userId: { roomId, userId } },
          data: {
            role: 'member',
            mutedAt: null,
            mutedUntil: null,
            reason: null,
          },
        })
        .catch(() => {
          /* race-safe: another request may have already cleared it */
        });
      return NEUTRAL_MEMBER;
    }
    return {
      role: 'muted',
      mutedUntil: row.mutedUntil,
      bannedAt: null,
      reason: row.reason,
    };
  }

  return NEUTRAL_MEMBER;
}

/** True if the user can post messages in the room. */
export async function canPost(roomId: string, userId: string): Promise<{
  allowed: boolean;
  reason?: 'MUTED' | 'BANNED';
  state?: MemberState;
}> {
  const state = await getMemberState(roomId, userId);
  if (state.role === 'banned') {
    return { allowed: false, reason: 'BANNED', state };
  }
  if (state.role === 'muted') {
    return { allowed: false, reason: 'MUTED', state };
  }
  return { allowed: true, state };
}

/** True if the user can read messages in the room. Banned users cannot. */
export async function canRead(
  roomId: string,
  userId: string,
): Promise<{ allowed: boolean; state: MemberState }> {
  const state = await getMemberState(roomId, userId);
  return { allowed: state.role !== 'banned', state };
}

/** Convenience: is this user the room owner? */
export function isRoomOwner(roomId: string, userId: string): boolean {
  return roomId === userId;
}
