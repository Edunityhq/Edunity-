'use client';

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-neutral-900">System Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Configure system-wide settings and preferences</p>
      </div>

      {/* Organization Settings */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Organization</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Organization Name
            </label>
            <input
              type="text"
              defaultValue="Edunity"
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-neutral-900 mb-1.5">
              Support Email
            </label>
            <input
              type="email"
              defaultValue="support@edunity.com"
              className="w-full px-4 py-2 border border-neutral-200 rounded-lg text-neutral-900 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-[hsl(var(--primary))]"
            />
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Security</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">Two-Factor Authentication</p>
              <p className="text-xs text-neutral-500">Require 2FA for all admin accounts</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">Session Timeout</p>
              <p className="text-xs text-neutral-500">Auto-logout after 24 hours of inactivity</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">API Rate Limiting</p>
              <p className="text-xs text-neutral-500">Limit API requests to prevent abuse</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white border border-neutral-200 rounded-lg p-6 space-y-4">
        <h2 className="text-lg font-semibold text-neutral-900">Notifications</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">Email Notifications</p>
              <p className="text-xs text-neutral-500">Send critical alerts via email</p>
            </div>
            <input type="checkbox" className="w-5 h-5" defaultChecked />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-neutral-900">Slack Notifications</p>
              <p className="text-xs text-neutral-500">Send alerts to Slack channel</p>
            </div>
            <input type="checkbox" className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button className="px-6 py-2 bg-[hsl(var(--primary))] text-white rounded font-medium hover:opacity-90">
          Save Changes
        </button>
      </div>
    </div>
  );
}

