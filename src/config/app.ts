/** Application identity and build metadata. */
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0'
/** User-facing version label (settings, about). */
export const APP_VERSION_LABEL = `v${APP_VERSION} BETA`
