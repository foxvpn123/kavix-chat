# Firestore Security Specification

## Data Invariants
1. **Users**: A user can only create or update their own profile. `id` must match `request.auth.uid` (or in zero-auth case, we'll use a unique ID stored in localStorage, but since `set_up_firebase` enables Firebase Auth, I should transition the user to Firebase Auth with Anonymous sign-in or similar, but for now I'll use the ID as the key).
2. **Messages**: Messages are immutable after creation. Only the sender can delete their own message (optional). `senderId` must match the authenticated user's ID.
3. **Typing**: Typing indicators are temporary and can be updated by the user they represent.

## The "Dirty Dozen" Payloads
1. **User Spoofing**: Attempt to update another user's `isOnline` status. (DENIED)
2. **Message Impersonation**: Create a message with a `senderId` that doesn't match the current user. (DENIED)
3. **Timestamp Manipulation**: Set a `timestamp` in the future or past. (DENIED: must use `request.time`)
4. **Invalid Message Body**: Send a message with a 2MB text string. (DENIED: size limit check)
5. **ID Poisoning**: Attempt to create a user with a 2KB ID string containing non-alphanumeric characters. (DENIED: `isValidId` check)
6. **Bypass Role**: Attempt to set an `isAdmin` field if it existed (not in blueprint, but good to test). (DENIED)
7. **Orphaned Message**: Create a message without a senderName. (DENIED: required field)
8. **Shadow Field**: Add a `hiddenMeta: "hacked"` field to a message. (DENIED: `hasOnly` keys check)
9. **Message Mutation**: Attempt to change the `text` of an existing message. (DENIED: immutability)
10. **Global Read Access**: Unauthenticated user attempting to list all users. (DENIED)
11. **Spamming Typing**: Update typing status 100 times per second (Rule-based rate limits are hard, but we can restrict keys).
12. **PII Leak**: authenticated user reading another user's private data (not in current blueprint but a risk).

## Rule Implementation Strategy
- Use `rules_version = '2'`.
- Implement `isValidUser`, `isValidMessage`, `isValidPresence` helpers.
- Enforce immutability and exact keys.
- Transition to Firebase Anonymous Auth for secure IDs.
