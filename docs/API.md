# ANOY API Documentation

## Profile APIs

### Create Profile

POST /api/v1/profile/create

Purpose:
Creates a new user profile.

Request:
{
 userId,
 username,
 displayName,
 bio,
 skills,
 interests
}


### Get Profile

GET /api/v1/profile/:username


Purpose:
Fetch public user profile.


### Update Profile

PUT /api/v1/profile/:username

Purpose:
Update profile information.