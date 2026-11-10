'use strict'

function inputMonitoringSettingsUrl() {
  if (process.platform !== 'darwin') return null
  return 'x-apple.systempreferences:com.apple.preference.security?Privacy_ListenEvent'
}

module.exports = {
  inputMonitoringSettingsUrl,
}
