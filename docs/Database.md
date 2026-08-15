# ANOY Database Design

## Why MongoDB?

## Database Principles

## Collections
##identities

Purpose:
Stores authentication and security-related information.

Responsibilities:
- User authentication
- Password management
- Email verification
- Login tracking
- Account status

Fields:
- _id
- email
- passwordHash
- emailVerified
- verificationOTP
- verificationOTPExpiry
- passwordResetOTP
- passwordResetExpiry
- lastLogin
- loginProvider
- status
- createdAt
- updatedAt
## Relationships

## Indexing Strategy

## Future Scalability

## Backup Strategy

## Security Considerations

## profiles

Purpose:
Stores public user information and social identity.

Responsibilities:
- User customization
- Social connections
- Reputation system
- Skills and interests
- Privacy settings

Fields:
- userId
- username
- displayName
- bio
- avatar
- coverImage
- skills
- interests
- reputationScore
- badges
- followers
- following
- privacy