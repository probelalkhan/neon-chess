#!/usr/bin/env node

/**
 * Add Firebase Preview Domain to Authorized Domains
 * 
 * This script uses the Google Identity Toolkit API v2 to programmatically
 * add preview channel domains to Firebase Authentication's authorized domains list.
 * 
 * Usage:
 *   node scripts/add-auth-domain.js <domain>
 * 
 * Environment Variables:
 *   FIREBASE_SERVICE_ACCOUNT - JSON string of Firebase service account credentials
 */

import { google } from 'googleapis'

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform']

/**
 * Extract project ID from service account credentials
 */
function getProjectId(credentials) {
    if (credentials.project_id) {
        return credentials.project_id
    }
    throw new Error('Project ID not found in service account credentials')
}

/**
 * Validate domain format
 */
function validateDomain(domain) {
    // Remove protocol if present
    domain = domain.replace(/^https?:\/\//, '')
    // Remove trailing slash
    domain = domain.replace(/\/$/, '')
    // Basic domain validation
    if (!domain || !domain.includes('.')) {
        throw new Error(`Invalid domain format: ${domain}`)
    }
    return domain
}

/**
 * Add domain to Firebase Auth authorized domains
 */
async function addAuthorizedDomain(domain) {
    try {
        // Get service account from environment
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT
        if (!serviceAccountJson) {
            throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable not set')
        }

        const credentials = JSON.parse(serviceAccountJson)
        const projectId = getProjectId(credentials)

        console.log(`📋 Project ID: ${projectId}`)
        console.log(`🌐 Domain to authorize: ${domain}`)

        // Authenticate with Google Cloud
        const auth = new google.auth.GoogleAuth({
            credentials,
            scopes: SCOPES,
        })

        const authClient = await auth.getClient()

        // Get Identity Toolkit API client
        const identitytoolkit = google.identitytoolkit('v2')

        // Construct the config resource name
        const configName = `projects/${projectId}/config`

        console.log('🔍 Fetching current authorized domains...')

        // Get current configuration
        const getResponse = await identitytoolkit.projects.getConfig({
            name: configName,
            auth: authClient,
        })

        const currentDomains = getResponse.data.authorizedDomains || []
        console.log(`📝 Current authorized domains (${currentDomains.length}):`, currentDomains)

        // Check if domain already exists
        if (currentDomains.includes(domain)) {
            console.log(`✅ Domain already authorized: ${domain}`)
            console.log('ℹ️  No changes needed.')
            return true
        }

        // Add new domain to the list
        const updatedDomains = [...currentDomains, domain]

        console.log('📝 Updating authorized domains...')

        // Update configuration
        await identitytoolkit.projects.updateConfig({
            name: configName,
            updateMask: 'authorizedDomains',
            requestBody: {
                authorizedDomains: updatedDomains,
            },
            auth: authClient,
        })

        console.log(`✅ Successfully added domain: ${domain}`)
        console.log(`📊 Total authorized domains: ${updatedDomains.length}`)
        return true

    } catch (error) {
        console.error('❌ Error adding authorized domain:', error.message)

        if (error.code === 403) {
            console.error('\n⚠️  Permission denied. The service account needs the following permission:')
            console.error('   - firebaseauth.configs.update')
            console.error('   OR the "Firebase Authentication Admin" role')
            console.error('\n📖 To fix this:')
            console.error('   1. Go to Google Cloud Console')
            console.error('   2. Navigate to IAM & Admin > Service Accounts')
            console.error('   3. Find your service account')
            console.error('   4. Grant the "Firebase Authentication Admin" role')
        } else if (error.code === 404) {
            console.error('\n⚠️  Project not found or Identity Toolkit API not enabled')
            console.error('   Make sure Firebase Authentication is enabled in your project')
        }

        throw error
    }
}

// Main execution
const domain = process.argv[2]

if (!domain) {
    console.error('❌ Usage: node add-auth-domain.js <domain>')
    console.error('   Example: node add-auth-domain.js neon-chess-6758e--pr1-xyz.web.app')
    process.exit(1)
}

try {
    const validatedDomain = validateDomain(domain)
    await addAuthorizedDomain(validatedDomain)
    process.exit(0)
} catch (error) {
    console.error('\n💥 Failed to add authorized domain')
    process.exit(1)
}
