'use client';

import { User, ResourceLimit, UserResourceLimit } from '../../types/admin.types';
import { ResourceCard } from './ResourceCard';

interface ResourceTabProps {
  resourceLimits: ResourceLimit[];
  userResourceLimits: UserResourceLimit[];
  users: User[];
  selectedUserForEdit: User | null;
  onSelectUser: (user: User | null) => void;
  onUpdateDefaultLimit: (id: string, field: 'dailyLimit' | 'monthlyLimit', value: number) => void;
  onUpdateUserLimit: (userId: string, featureId: string, field: 'daily' | 'monthly', value: number) => void;
  onFinishEditing: () => void;
  getUserLimit: (userId: string, featureId: string) => { dailyLimit: number; monthlyLimit: number };
}

export const ResourceTab = ({
  resourceLimits,
  userResourceLimits,
  users,
  selectedUserForEdit,
  onSelectUser,
  onUpdateDefaultLimit,
  onUpdateUserLimit,
  onFinishEditing,
  getUserLimit,
}: ResourceTabProps) => {
  return (
    <div className="space-y-5 animate-fadeIn">
      {/* Info Banner */}
      <div className="bg-linear-to-r from-[#e6f6f4] to-[#d9f2ef] backdrop-blur-sm rounded-xl border border-[#00a991]/20 p-4 text-[#007f6d] text-sm">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#00a991]/10 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#00a991]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-medium">
            {selectedUserForEdit 
              ? `Mengedit batasan untuk ${selectedUserForEdit.username}`
              : 'Atur batasan default untuk semua pengguna'}
          </p>
        </div>
      </div>

      {/* User Select for Custom Limit */}
      {!selectedUserForEdit && (
        <div className="mb-4 text-gray-400">
          <select 
            onChange={(e) => {
              const user = users.find(u => u.id === e.target.value);
              if (user) onSelectUser(user);
            }}
            className="px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm"
            defaultValue=""
          >
            <option value="" disabled>-- Pilih user untuk custom limit --</option>
            {users.filter(u => u.isActive).map(user => (
              <option key={user.id} value={user.id}>{user.username}</option>
            ))}
          </select>
        </div>
      )}

      {/* Resource Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {resourceLimits.map((limit) => {
          const userLimit = selectedUserForEdit 
            ? getUserLimit(selectedUserForEdit.id, limit.id)
            : { dailyLimit: limit.dailyLimit, monthlyLimit: limit.monthlyLimit };
          
          return (
            <ResourceCard
              key={limit.id}
              limit={limit}
              userLimit={userLimit}
              isCustomMode={!!selectedUserForEdit}
              onDailyChange={(value) => {
                if (selectedUserForEdit) {
                  onUpdateUserLimit(selectedUserForEdit.id, limit.id, 'daily', value);
                } else {
                  onUpdateDefaultLimit(limit.id, 'dailyLimit', value);
                }
              }}
              onMonthlyChange={(value) => {
                if (selectedUserForEdit) {
                  onUpdateUserLimit(selectedUserForEdit.id, limit.id, 'monthly', value);
                } else {
                  onUpdateDefaultLimit(limit.id, 'monthlyLimit', value);
                }
              }}
            />
          );
        })}
      </div>

      {/* Finish Editing Button */}
      {selectedUserForEdit && (
        <div className="flex justify-end">
          <button
            onClick={onFinishEditing}
            className="px-5 py-2.5 text-sm font-medium rounded-lg bg-linear-to-r from-[#00a991] to-[#008774] text-white hover:from-[#008774] hover:to-[#006557] transition-all duration-300 shadow-md hover:shadow-lg active:scale-95"
          >
            Selesai
          </button>
        </div>
      )}
    </div>
  );
};