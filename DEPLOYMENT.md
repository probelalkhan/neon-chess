# Deployment & CI/CD

This project uses Firebase Hosting with GitHub Actions for continuous deployment.

## Deployment Workflows

### 1. PR Preview Deployments
- **Trigger**: Automatically runs on every Pull Request (opened, updated, or reopened)
- **Workflow**: `.github/workflows/firebase-hosting-pr.yml`
- **Purpose**: Creates a temporary preview environment for each PR
- **Preview URL**: Posted as a comment on the PR by the Firebase GitHub bot
- **Expiration**: Preview channels expire after 7 days
- **Benefits**: 
  - Test changes in a live environment before merging
  - Share preview links with team members for review
  - Catch deployment issues early
- **Authentication**: Preview domains are automatically added to Firebase Auth authorized domains

#### Automated Domain Authorization

The PR preview workflow automatically authorizes preview domains for Firebase Authentication:

1. **Before Deployment**: The workflow extracts the preview domain from the PR number and branch name
2. **Authorization Script**: Runs `scripts/add-auth-domain.js` using Google Identity Toolkit API v2
3. **Domain Added**: The preview domain is added to Firebase Auth's authorized domains list
4. **Idempotent**: Safe to run multiple times - skips if domain already exists

**Required Permissions**: The Firebase service account needs the `firebaseauth.configs.update` permission or the "Firebase Authentication Admin" role. If you see permission errors, grant this role in Google Cloud Console → IAM & Admin → Service Accounts.

### 2. Production Deployment
- **Trigger**: Automatically runs when code is merged to `main` branch
- **Workflow**: `.github/workflows/firebase-hosting.yml`
- **Purpose**: Deploys to the live production site
- **URL**: https://neon-chess-6758e.web.app (or your custom domain)

## Setting Up Branch Protection

To ensure PRs can only be merged after successful deployment, configure branch protection rules:

### Steps to Enable Branch Protection:

1. **Go to Repository Settings**
   - Navigate to your GitHub repository
   - Click on `Settings` → `Branches`

2. **Add Branch Protection Rule**
   - Click `Add rule`
   - Branch name pattern: `main`

3. **Configure Protection Settings**
   - ✅ **Require a pull request before merging**
     - Require approvals: 1 (optional, based on team size)
   - ✅ **Require status checks to pass before merging**
     - Search and select: `build_and_preview`
     - ✅ Require branches to be up to date before merging
   - ✅ **Do not allow bypassing the above settings** (recommended)

4. **Save Changes**

### What This Does:
- PRs cannot be merged until the `build_and_preview` job succeeds
- Ensures the build completes successfully
- Verifies the preview deployment works
- Prevents broken code from reaching production

## Manual Deployment

If you need to deploy manually:

```bash
# Install Firebase CLI (if not already installed)
npm install -g firebase-tools

# Login to Firebase
firebase login

# Build the project
npm run build

# Deploy to production
firebase deploy --only hosting

# Deploy to a specific preview channel
firebase hosting:channel:deploy CHANNEL_NAME
```

## Environment Variables & Secrets

The following secrets must be configured in GitHub repository settings:

- `FIREBASE_SERVICE_ACCOUNT_NEON_CHESS_6758E`: Firebase service account key (auto-generated)
- `GITHUB_TOKEN`: Automatically provided by GitHub Actions

### How to Add Secrets:
1. Go to repository `Settings` → `Secrets and variables` → `Actions`
2. Click `New repository secret`
3. Add the secret name and value

## Troubleshooting

### Preview deployment failed
- Check that the build succeeds locally: `npm run build`
- Verify Firebase service account has proper permissions
- Check workflow logs in the Actions tab

### Production deployment not triggering
- Ensure the PR was merged (not closed without merging)
- Check that the workflow file is on the `main` branch
- Verify GitHub Actions is enabled for the repository

### Preview URL not appearing in PR comments
- Check that the Firebase GitHub bot has access to the repository
- Verify `GITHUB_TOKEN` permissions in workflow settings
- The bot may need to be invited to private repositories

### Domain authorization failed (auth/unauthorized-domain)
- Check the "Authorize Preview Domain" step in GitHub Actions logs
- **Permission Error (403)**: Service account needs "Firebase Authentication Admin" role
  - Go to Google Cloud Console → IAM & Admin → Service Accounts
  - Find your Firebase service account
  - Grant the "Firebase Authentication Admin" role
- **Manual Workaround**: Add the preview domain manually in Firebase Console
  - Go to Authentication → Settings → Authorized domains
  - Add the domain from the error message
- Verify the `FIREBASE_SERVICE_ACCOUNT_NEON_CHESS_6758E` secret is correctly set
