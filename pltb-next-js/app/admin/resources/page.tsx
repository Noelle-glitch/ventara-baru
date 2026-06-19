'use client';
import { useState } from 'react';
import Header from '@/app/components/layout/Header';
import Sidebar from '@/app/components/layout/Sidebar';
import { ResourceTab } from '@/app/components/admin/ResourceTab';
import { useAdminData } from '@/app/hooks/useAdminData';
import { User } from '@/app/types/admin.types';

export default function ResourcesPage() {
  const { users, resourceLimits, userResourceLimits, updateResourceLimit, updateUserResourceLimit, getUserLimit } = useAdminData();
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <Header />
        <div className="p-8">
          <div className="max-w-5xl mx-auto">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-1">Manage Resources</h2>
              <p className="text-gray-600 text-sm">Kelola pengguna, resource, dan pantau aktivitas sistem</p>
            </div>
            <ResourceTab
              resourceLimits={resourceLimits}
              userResourceLimits={userResourceLimits}
              users={users}
              selectedUserForEdit={selectedUserForEdit}
              onSelectUser={setSelectedUserForEdit}
              onUpdateDefaultLimit={updateResourceLimit}
              onUpdateUserLimit={updateUserResourceLimit}
              getUserLimit={getUserLimit}
              onFinishEditing={() => setSelectedUserForEdit(null)}
            />
          </div>
        </div>
      </main>
    </div>
  );
}