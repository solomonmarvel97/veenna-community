/** Legal and security pages live on the Veenna site. */
const LEGAL_ORIGIN = 'https://veenna.com'

function getPublicTermsOfServiceUrl(): string {
  return `${LEGAL_ORIGIN}/legal/terms-of-service`
}

function getPublicPrivacyPolicyUrl(): string {
  return `${LEGAL_ORIGIN}/legal/privacy-policy`
}

/** Every legal page, in the order Settings lists them. */
export function getLegalPages(): Array<{ label: string; description: string; url: string }> {
  return [
    {
      label: 'Terms of Service',
      description: 'The terms for using Veenna Community.',
      url: getPublicTermsOfServiceUrl(),
    },
    {
      label: 'Privacy Policy',
      description: 'What stays on your device and what, if anything, leaves it.',
      url: getPublicPrivacyPolicyUrl(),
    },
  ]
}
